// @noErrors
// @module: esnext
// @filename: index.ts
import { ensureDirSync, existsSync, readdirSync, statSync, writeFileSync } from 'fs-extra';
import csv from 'csvtojson'
import { v7 } from 'uuid'
import { RecordModel as record, sleep, Tdoc } from 'hydrooj'
import {
    ContestModel,
    Context,
    db, Handler, ObjectID, param, PRIV, Types, AdmZip
} from 'hydrooj';
declare module 'hydrooj' {
    interface Collections {
        packJudge: PackJudge; // 声明数据表类型
    }
}

import path from 'path';
import { PackJudge } from './src/model';
import config from './config';
import { dataURLToU8Array, readGBKFile, unzip } from './src/tools';
import { WithId } from 'mongodb';
const coll = db.collection('packJudge');



class TestHander extends Handler {
    async get(body) {
        try {
            let tdoc = await ContestModel.get(body.domainId, new ObjectID(body.id));
            this.response.body = {
                test: 'test', id: body.id, tdoc
            };
            this.response.body.overrideNav = [
                {
                    name: 'contest_main',
                    args: {},
                    displayName: 'Back to contest list',
                    checker: () => true,
                },
                {
                    name: 'contest_detail',
                    displayName: tdoc.title,
                    args: { tid: new ObjectID(body.id), prefix: 'contest_detail' },
                    checker: () => true,
                },
                {
                    name: 'contest_problemlist',
                    args: { tid: new ObjectID(body.id), prefix: 'contest_problemlist' },
                    checker: () => true,
                },
                {
                    name: 'contest_scoreboard',
                    args: { tid: new ObjectID(body.id), prefix: 'contest_scoreboard' },
                    checker: () => ContestModel.canShowScoreboard.call(this, tdoc, true),
                },
                {
                    name: 'contest_packjudge',
                    displayName: '批量评测',
                    args: { id: new ObjectID(body.id), prefix: 'contest_packjudge' },
                    checker: () => true,
                }
            ]
            this.response.template = 'contest_pack_judge.html';
        }
        catch (err) {
            this.response.redirect = `error`
        }
        console.log(body.id);
    }
    renderTitle(): string {
        return `批量评测`;
    }
    @param('packJudgeId', Types.String)
    @param('idx', Types.Int)
    async postPackJudgeResult(_: any, packJudgeId: string, idx: number) {
        let pjudge = await coll.findOne({ _id: packJudgeId });
        let judgeResult: Record<string, Record<string, any>> = {};
        for (let user of Object.keys(pjudge.judgeRecords)) {
            let userRecord = pjudge.judgeRecords[user];
            judgeResult[user] = {};
            for (let problem of Object.keys(userRecord)) {
                let recordId = userRecord[problem];
                // 还没扫描到的
                if(recordId === null || recordId === undefined)
                {
                    judgeResult[user][problem] = null
                }
                // 扫描过，代码不存在的
                else if (recordId.equals(new ObjectID(0))) {

                }
                else{
                    let recordDoc = await record.get(recordId);
                    judgeResult[user][problem] = {
                        recordId: recordId,
                        score: recordDoc.score,
                        time: recordDoc.time,
                        memory: recordDoc.memory,
                        status: recordDoc.status
                    }
                }
            }
        }
        this.response.type = `json`;
        this.response.body = {
            judgeResult,
            idx
        }
    }
    startJudge(packJudgeId: string) {
        return new Promise<void>(async (resolve, reject) => {
            let pjudge: WithId<PackJudge>;
            try {
                pjudge = await coll.findOne({ _id: packJudgeId });
            }
            catch (err) {
                throw (new Error('PackJudge Record not found'));
            }
            let filePath = path.join(pjudge.filePath, `package`);
            let files = readdirSync(filePath);
            let contest: Tdoc
            try {
                contest = await ContestModel.get(this.domain._id, new ObjectID(pjudge.contestId));
            }
            catch (err) {
                throw (new Error('Contest not found'));
            }
            let pids = contest.pids;
            if (files.length === 1 && statSync(path.join(filePath, files[0])).isDirectory()) {
                filePath = path.join(filePath, files[0]);
            }
            let hasAnswerDir = files.filter(x => (x === 'answer' || x === 'answers'));
            if (hasAnswerDir.length > 0) {
                filePath = path.join(filePath, hasAnswerDir[0]);
            }
            else {
                throw (new Error('No answer directory found'));
            }

            let problemDirs = pjudge.problemDirs;
            let judgeRecords: Record<string, Record<string, ObjectID>> = {};
            const nameList = pjudge.nameList;
            for (let user of nameList) {
                const uid = user.id;
                judgeRecords[uid] = {};

                const userPackPath = path.join(filePath, uid);
                if (!existsSync(userPackPath) || !statSync(userPackPath).isDirectory()) {
                    for (let problem of problemDirs) {
                        judgeRecords[uid][problem] = new ObjectID(0);
                    }
                    continue;
                }
                for (let i = 0; i < problemDirs.length; i++) {
                    let problem = problemDirs[i];
                    if (existsSync(path.join(userPackPath, problem, `${problem}.cpp`))) {
                        let code = await readGBKFile(path.join(userPackPath, problem, `${problem}.cpp`));
                        code = `// packjudge: ${packJudgeId}
// user: ${uid}
// problem: ${problem}

` + code;
                        judgeRecords[uid][problem] = (await record.add(this.domain._id, pids[i], config.judger.uid, `cc.cc14o2`, code, true, {
                            type: `judge`
                        }));
                        await sleep(500);
                    }
                }
                coll.findOneAndUpdate({ _id: pjudge._id }, {
                    $set: {
                        judgeRecords: judgeRecords
                    }
                }, { upsert: false });
            }
        })
    }
    @param('packJudgeId', Types.String)
    async postStartjudge(_: any, packJudgeId: string) {
        return new Promise<void>(async (resolve) => {
            this.response.body = {
                code:0,
                msg: `Judge Start!`
            }
            resolve();
            this.startJudge(packJudgeId);
        })
    }
    async scanJudgePack(_id: string) {
        return new Promise<void>(async (resolve, reject) => {
            await coll.findOne({ _id: _id }).then(async (doc) => {
                // console.log(doc);
                let filePath = doc.filePath;
                let packagePath = path.join(filePath, `package`)
                await unzip(path.join(filePath, `package.zip`), packagePath);
                let packs = readdirSync(packagePath);
                // 子文件夹
                if (packs.length === 1 && statSync(path.join(packagePath, packs[0])).isDirectory()) {
                    packagePath = path.join(packagePath, packs[0]);
                    packs = readdirSync(packagePath);
                }
                // 检查 namelist.csv
                if (!packs.includes('namelist.csv')) {
                    reject(new Error('namelist.csv not found'));
                }

                // 读取名单并插入数据库
                try {
                    let namelist = await csv({
                        noheader: true,
                        headers: ['id', 'name']
                    }).fromString(await readGBKFile(path.join(packagePath, 'namelist.csv')))
                    await coll.updateOne({ _id: _id }, {
                        $set: {
                            nameList: namelist
                        }
                    })
                    resolve();
                }
                catch (err) {
                    reject(new Error(`Fail on reading namelist.csv: ${err}`));
                }
            })
        })
    }
    async createPackJudge(contestId: string, pack: Uint8Array, problemDirs: string[]) {
        const uuid = v7();
        const filePath = path.join(config.tmpdir, uuid);
        try {
            await coll.insertOne({
                domain: this.domain._id,
                _id: uuid,
                contestId,
                filePath,
                judgeRecords: {},
                judgeResult: {},
                problemDirs
            });
            ensureDirSync(filePath);
            writeFileSync(path.join(filePath, `package.zip`), pack);
        } catch (err) {
            console.error(err);
        }
        await this.scanJudgePack(uuid);
        return uuid;
    }
    @param('file', Types.String)
    @param('problemDirs', Types.ArrayOf<[(v: any) => true]>)
    async postUpload(_body: Record<string, any>, file: string, problemDirs: string[]) {
        this.response.type = `json`;
        let rid = ``;
        this.response.body = {
            rid: rid = await this.createPackJudge(_body.id, dataURLToU8Array(file), problemDirs),
            namelist: (await coll.findOne({ _id: rid })).nameList
        }

    }

}
// Hydro会在服务初始化完成后调用该函数。
export async function apply(ctx: Context) {
    // 注册一个名为 paste_create 的路由，匹配 '/paste/create'，
    // 使用PasteCreateHandler处理，访问改路由需要PRIV.PRIV_USER_PROFILE权限
    // 提示：路由匹配基于 path-to-regexp
    ctx.Route('contest_packjudge', '/contest/:id/pack', TestHander, [
        PRIV.PRIV_MOD_BADGE
    ]);
}