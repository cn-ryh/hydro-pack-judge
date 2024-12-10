import { $, addPage, NamedPage } from '@hydrooj/ui-default'
import axios from 'axios'
import { Tdoc } from 'hydrooj/src/interface';
import 'layui'
declare const layui: any;
let rid = ``;
addPage(new NamedPage(['contest_pack_judge'], () => {
    console.log(UiContext);
    let tdoc = UiContext.tdoc as Tdoc;
    ($("#submit")[0] as HTMLButtonElement).addEventListener(`click`, () => {
        let file = ($("#pack_judge_file")[0] as HTMLInputElement).files![0];
        if (file === null) {
            alert(`Please select a file`);
            return;
        }
        let problemDirs = ($(`#problemDirs`)[0] as HTMLInputElement).value.split(`,`).map(e => e.trim());
        if (problemDirs.length !== UiContext.tdoc.pids.length) {
            alert(`Please input the same number as problems, need ${UiContext.tdoc.pids.length}`);
            return;
        }
        let fileReader = new FileReader();
        fileReader.onload = (e) => {

            axios.post(`/contest/${tdoc.docId}/pack`, {
                operation: 'upload',
                file: e.target.result,
                problemDirs,
            }, { headers: { 'Content-Type': 'application/json' } }).then((data) => {
                $(`#startJudge`).attr(`style`, `display: inline-block;`);
                rid = data.data.rid;
                const namelist: Record<string, string>[] = data.data.namelist
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
            setTimeout(() => {
                axios.post(`/contest/${tdoc.docId}/pack`, {
                    operation: `pack_judge_result`,
                    packJudgeId: rid
                }).then((data) => {
                    console.log(data.data);
                })
            }, 2000);
            // alert(`Start judge successfully`);
        });
    });

}))

addPage(new NamedPage(['contest_detail', 'contest_problemlist', 'contest_scoreboard'], () => {
    $(".nav__list.nav__list--main .nav_more").before(`
         <li class="nav__list-item"><a href="/contest/${UiContext.tdoc._id}/pack" class="nav__item">批量评测</a></li>
        `)
}))