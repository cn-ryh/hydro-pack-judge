import { $, addPage, NamedPage } from '@hydrooj/ui-default'
import axios from 'axios'
import { Tdoc } from 'hydrooj/src/interface';
import 'layui'
declare const layui: any;
let rid: string = ``;
let Interval: NodeJS.Timeout;
let failedCnt = 0;
const table = layui.table;
let problemDirs: string[] = [];
let problem_number = 0;

interface IProblemResult {
    score: number;
    time: number;
    memory: number;
    recordId: string;
}
interface IRemapedResult {
    rate: number;
    id: string;
    name: string;
    problems: (IProblemResult | undefined)[];
    score: number;
}
let namelist: Record<string, string>[]
/**
 * 渲染评测结果。
 * 该函数接收原始结果数据，将其重新映射为包含评分、ID、名称、问题详情和总分的结构化数组，
 * 并根据总分进行降序排序，处理同分排名情况，最后将结果渲染到表格中。
 *
 * @param {Record<string,Record<string,any>>} result - 原始结果数据，键为用户ID，值为该用户的详细答题数据。
 */
function renderJudgeResult(result: Record<string, Record<string, any>>): void {

    /**
     * 将原始结果数据重新映射为包含评分、ID、名称、问题详情和总分的结构化数组。
     * 结果数组会根据总分进行降序排序，并处理同分排名情况。
     *
     * @param {Record<string,Record<string,any>>} result - 原始结果数据，键为用户ID，值为该用户的详细答题数据。
     * @returns {IRemapedResult[]} - 重新映射后的结果数组，包含每个用户的评分、ID、名称、问题详情和总分。
     */
    function remapResult(result: Record<string, Record<string, any>>): IRemapedResult[] {
        let AllFinished = Object.keys(result).length === namelist.length;

        let remapedResult: (IRemapedResult)[] = [];
        for (let user of Object.keys(result)) {
            const userData = result[user];;
            const idx = remapedResult.push({
                rate: 0,
                id: user,
                name: namelist.filter((e) => { return e.id === user }).map((e) => e.name)[0]!,
                problems: [],
                score: 0
            }) - 1;
            for (let problem of Object.keys(userData)) {
                const problemData = userData[problem];
                if (problemData.status === 0) {
                    AllFinished = false;
                    remapedResult[idx].problems.push(undefined);
                    continue;
                }
                remapedResult[idx].problems.push({
                    score: problemData.score,
                    time: problemData.time,
                    memory: problemData.memory,
                    recordId: problemData.recordId,
                })
                remapedResult[idx].score += problemData.score;
            }
        }
        remapedResult.sort((a, b) => b.score - a.score);
        // 处理同分排名
        let lastScore = -1;
        for (let i = 0; i < remapedResult.length; i++) {
            if (lastScore === remapedResult[i].score) {
                remapedResult[i].rate = remapedResult[i - 1].rate;
            } else {
                remapedResult[i].rate = i + 1;
                lastScore = remapedResult[i].score;
            }
        }
        if (AllFinished) {
            clearInterval(Interval);
        }
        return remapedResult;
    }

    let data = remapResult(result);
    let childs = (() => {
        let problems: Record<string, any>[] = [];
        for (let i = 0; i < problem_number; i++) {
            problems.push({
                title: problemDirs[i],
                field: `problems`,
                align: `center`,
                unresize: true,
                templet: ((idx: number) => {
                    return (rowData: Record<string, any>) => {
                        if (rowData.problems[idx] === undefined) {
                            return `<div style="color:blue">等待评测</div>`
                        }
                        return `<div class="judge-result-problem-cell">
                            <span><a href="/record/${rowData.problems[idx].recordId}">${rowData.problems[idx].score
                            }</a></span><br /> <span>
                                time:${rowData.problems[idx].time}
                            </span>
                            <br /> <span>
                                memory:${rowData.problems[idx].memory}
                            </span>
                        </div>`
                    }
                })(i)
            });
        }
        console.log(problems);
        return problems;
    })();
    layui.table.render({
        elem: `#judgeResultTable`,
        cols: [[ // 表头
            { title: '排名', field: `rate`, rowspan: 2, align: `center`, unresize: true },
            { title: '准考证号', field: `id`, rowspan: 2, align: `center`, unresize: true },
            { title: '姓名', field: `name`, rowspan: 2, align: `center`, unresize: true },
            { title: '题目情况', colspan: problem_number },
            { title: '总分', rowspan: 2, field: `score`, align: `center`, unresize: true }
        ], childs],
        data: data,
        toolbar: 'default',
        even: true
    })
}
let idx = 0;
let mxIdx = 0;
/**
 * 获取评测结果的函数。如果连续失败次数超过7次，将停止获取并弹出警告。否则，发送POST请求获取评测结果，并根据结果进行相应处理。
 * @returns {void}
 */
function getPackJudgeResult(): void {
    if (failedCnt > 7) {
        alert(`已连续 7 次获取评测状态失败，将不会继续获取，请检查日志`);
        clearInterval(Interval);
        return;
    }
    axios.post(`/contest/${UiContext.tdoc.docId}/pack`, {
        operation: `pack_judge_result`,
        packJudgeId: rid,
        idx: ++idx
    }, {
        headers: {
            'Content-Type': 'application/json'
        }
    }).then((res) => {
        failedCnt = 0;
        if(res.data.idx < mxIdx)
        {
            return;
        }
        mxIdx = res.data.idx;
        let result = res.data.judgeResult;
        if (result === null || result === undefined) {
            ++failedCnt;
            return;
        }
        renderJudgeResult(result);
    }).catch((err) => {
        console.error(err);
        ++failedCnt;
    })
}
addPage(new NamedPage(['contest_pack_judge'], () => {
    problem_number=  UiContext.tdoc.pids.length
    console.log(UiContext);
    let tdoc = UiContext.tdoc as Tdoc;
    ($("#submit")[0] as HTMLButtonElement).addEventListener(`click`, () => {
        let file = ($("#pack_judge_file")[0] as HTMLInputElement).files![0];
        if (file === null) {
            alert(`Please select a file`);
            return;
        }
        problemDirs = ($(`#problemDirs`)[0] as HTMLInputElement).value.split(`,`).map(e => e.trim());
        if (problemDirs.length !== UiContext.tdoc.pids.length) {
            alert(`Please input the same number as problems, need ${UiContext.tdoc.pids.length}`);
            return;
        }
        let fileReader = new FileReader();
        fileReader.onload = (e) => {

            axios.post(`/contest/${tdoc.docId}/pack`, {
                operation: 'upload',
                file: e.target!.result,
                problemDirs,
            }, { headers: { 'Content-Type': 'application/json' } }).then((data) => {
                $(`#startJudge`).attr(`style`, `display: inline-block;`);
                rid = data.data.rid;
                namelist = data.data.namelist
                const tree = layui.tree;
                // 渲染 namelist
                tree.render({
                    elem: '#ID-tree-demo',
                    data: namelist.map(e => {
                        return {
                            title: e.id,
                            id: e.id,
                            children:
                                (() => {
                                    let p: Record<string, string>[] = []
                                    for (let x of Object.keys(e)) {
                                        p.push({
                                            title: `${x}: ${e[x]}`,
                                            id: e.id + `_${x}`
                                        })
                                    }
                                    return p;
                                })()

                        }
                    }),
                    showCheckbox: false,  // 是否显示复选框
                    onlyIconControl: true,  // 是否仅允许节点左侧图标控制展开收缩
                    id: 'demo-id-1',
                    isJump: false, // 是否允许点击节点时弹出新窗口跳转
                });
            })
        }
        fileReader.readAsDataURL(file);
    });
    ($(`#startJudge`)[0] as HTMLButtonElement).addEventListener(`click`, () => {
        axios.post(`/contest/${tdoc.docId}/pack`, {
            operation: 'startjudge',
            packJudgeId: rid,
        }, {
            headers: { 'Content-Type': 'application/json' }
        }).then((res) => {
            console.log(res.data);
            getPackJudgeResult();
            layui.layer.open({
                type: 1,
                area: ['70vw', '80vh'],
                title: '评测结果',
                shade: 0.6, // 遮罩透明度
                shadeClose: false, // 点击遮罩区域，关闭弹层
                maxmin: true, // 允许全屏最小化
                anim: 0, // 0-6 的动画形式，-1 不开启
                content: `
                <div id="layui-layer-content" style="padding:15px 20px">
                    <table id="judgeResultTable"></table>
                </div>
                `
            });
            Interval = setInterval(getPackJudgeResult, Math.min(10000, namelist.length * problem_number * 3.5));
        });
    });
}))

addPage(new NamedPage(['contest_detail', 'contest_problemlist', 'contest_scoreboard'], () => {
    $(".nav__list.nav__list--main .nav_more").before(`
         <li class="nav__list-item"><a href="/contest/${UiContext.tdoc._id}/pack" class="nav__item">批量评测</a></li>
        `)
}))