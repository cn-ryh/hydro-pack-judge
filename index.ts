// @noErrors
// @module: esnext
// @filename: index.ts
import { ensureDirSync, readdirSync, statSync, writeFileSync } from 'fs-extra';
import csv from 'csvtojson'
import { v7 } from 'uuid'
import { RecordModel as record } from 'hydrooj'
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
const coll = db.collection('packJudge');



class TestHander extends Handler {
    async get(body) {
        try {
            let tdoc = await ContestModel.get(body.domainId, new ObjectID(body.id));
            this.response.body = {
                test: 'test', id: body.id, tdoc
            };
            this.response.template = 'contest_pack_judge.html';
        }
        catch (err) {
            this.response.redirect = `error`
        }
        console.log(body.id);
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
                _id: uuid,
                contestId,
                filePath,
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
    async postUpload(_body: Record<string, any>, file: string) {
        this.response.type = `json`;
        let rid = ``;
        this.response.body = {
            rid: rid = await this.createPackJudge(_body.id, dataURLToU8Array(file), [

            ]),
            namelist: (await coll.findOne({_id:rid})).nameList
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