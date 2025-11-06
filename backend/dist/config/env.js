"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requiredEnv = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// Try multiple common locations for the .env when running inside docker and locally
const candidatePaths = [
    path_1.default.resolve(__dirname, '../../.env'), // project root when running ts-node from src
    path_1.default.resolve(__dirname, '../.env'), // backend/.env if exists
    path_1.default.resolve(process.cwd(), '.env'), // current working directory
];
for (const p of candidatePaths) {
    try {
        if (fs_1.default.existsSync(p)) {
            dotenv_1.default.config({ path: p, override: false });
            // Only load the first existing file to avoid unintended overrides
            break;
        }
    }
    catch {
        // ignore
    }
}
const requiredEnv = (key) => {
    const v = process.env[key];
    if (!v)
        throw new Error(`Missing required env var: ${key}`);
    return v;
};
exports.requiredEnv = requiredEnv;
