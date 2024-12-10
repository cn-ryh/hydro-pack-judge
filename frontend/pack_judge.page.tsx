import { $, addPage, NamedPage } from '@hydrooj/ui-default'
import axios from 'axios'
import { Tdoc } from 'hydrooj/src/interface';
import 'layui'
declare const layui:any;
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
        let fileReader = new FileReader();
        fileReader.onload = (e) => {
            let form = new FormData()
            form.append('file', e.target!.result as string);
            form.append('operation', 'upload');
            axios.post(`/contest/${tdoc.docId}/pack`, form, { headers: { 'Content-Type': 'multipart/form-data' } }).then((data) => {
                rid = data.data.rid;
                const namelist: Record<string, string>[] = data.data.namelist
                const tree = layui.tree;
                // 渲染
                tree.render({
                    elem: '#ID-tree-demo',
                    data: namelist.map(e => {
                        return {
                            title: e.id,
                            id: e.id,
                            children:
                                (() => {
                                    let p:Record<string,string>[] = []
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
    })
}))