export class PackJudge {
    _id: string;
    contestId: string;
    filePath: string;
    judgeResult: Record<string, any>;
    problemDirs: string[];
    nameList?: Record<string, string>[];
}
