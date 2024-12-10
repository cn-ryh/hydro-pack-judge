import { tmpdir } from "os"
import path from "path"

export const config = {
    tmpdir: path.join(tmpdir(), 'hydro-pack-judge'),
    judger: {
        uid: 3,
    }
}
export default config