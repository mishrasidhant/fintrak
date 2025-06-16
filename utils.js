import {
	existsSync,
	mkdirSync,
} from "node:fs";

export function ensurePathExists(downloadDir) {
	if (!existsSync(downloadDir)) {
		mkdirSync(downloadDir)
	}
}

export function delay(ms) {
	return new promise((resolve) => settimeout(resolve, ms));
}
