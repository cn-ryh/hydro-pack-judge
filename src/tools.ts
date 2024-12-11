import AdmZip from "adm-zip";
import { createReadStream, existsSync, ReadStream } from "fs-extra";
import iconv from 'iconv-lite';
import jschardet from 'jschardet';
/**
 * 将数据URL转换为Uint8Array。
 * @param dataurl - 包含数据的data URL字符串。
 * @returns Uint8Array - 转换后的二进制数据数组。
 */
export function dataURLToU8Array(dataurl: string) {

    const arr = dataurl.split(','),
        bstr = atob(arr[1]);
    let len = bstr.length,
        u8arr = new Uint8Array(len);
    while (len--) {
        u8arr[len] = bstr.charCodeAt(len)
    }
    return u8arr;
}
/**
 * 解压缩指定路径的zip文件到目标路径。
 * @param filePath - 需要解压的zip文件的路径。
 * @param distPath - 解压后文件存放的目标路径。
 * @returns 返回一个Promise，成功时无返回值，失败时抛出错误。
 * @throws 如果指定的zip文件不存在，将抛出'Zip File Not Found'错误。
 * @throws 如果解压缩过程中发生错误，将抛出相应的错误。
 */

export function unzip(filePath: string, distPath: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        if (!existsSync(filePath)) {
            reject(new Error('Zip File Not Found'));
        }
        // ensureDirSync(distPath);
        try {
            const zip = new AdmZip(filePath);
            zip.extractAllTo(distPath, true);
            resolve();
        } catch (err) {
            reject(err);
        }

    })
}

/**
 * 异步读取GBK编码的文件内容
 * @param filePath - 要读取的文件路径。
 * @returns 返回一个Promise，返回解析后的内容。
 * @throws 如果读取文件或转换编码过程中发生错误，Promise将被拒绝并抛出错误。
 */
export function readGBKFile(filePath: string) {
    return new Promise<string>((resolve, reject) => {
        try {
            const stream: ReadStream = createReadStream(filePath, { encoding: 'binary' });
            let data = '';
            stream.on('error', err => {
                console.error('读取行错误');
                console.error(err);
            });
            stream.on('data', item => {
                data += item;
            });
            stream.on('end', () => {
                const buf = Buffer.from(data, 'binary');
                // 获得正常的字符串，没有乱码
                let det = jschardet.detect(buf);
                const str = iconv.decode(buf, det.encoding);
                resolve(str);
            });
        } catch (err) {
            reject(err);
        }
    })
} 

export async function sleep(time:number)
{
    return new Promise<void>((resolve)=>{
        setTimeout(()=>{resolve()},time);
    })
}