import { ObjectID } from "hydrooj";

export class PackJudge {
    _id: string;
    domain: string = `system`;
    contestId: string;
    filePath: string;
    judgeRecords: Record<string, Record<string,ObjectID>>;
    judgeResult: Record<string, Record<string, any>>;
    problemDirs: string[];
    nameList?: Record<string, string>[];
}
