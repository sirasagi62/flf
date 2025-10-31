import * as fs from 'fs';
import * as fsPromises from 'fs/promises';

/**
 * Defines the structure of the data loaded from the JSON file.
 */
export interface BufferInfo {
    buffername: string;
    content: string;
}

/**
 * Reads a JSON file asynchronously and returns the parsed BufferInfo object.
 *
 * @param {string} filePath - The path to the JSON file to read.
 * @returns {Promise<BufferInfo>} - A Promise that resolves with the parsed BufferInfo object.
 */
export async function loadBufferInfoAsync(filePath: string): Promise<BufferInfo[]> {
    try {
        // fsPromises.readFile returns a Buffer by default, so we specify 'utf8' to get a string.
        const data = await fsPromises.readFile(filePath, 'utf8');

        // Use 'as BufferInfo' to inform TypeScript of the expected shape after parsing.
        const bufferInfo = JSON.parse(data) as BufferInfo[];
        return bufferInfo;
    } catch (error) {
        // TypeScript infers the error type as 'unknown'
        if (error instanceof Error) {
            console.error(`Error reading or parsing JSON file asynchronously: ${filePath}`, error.message);
        } else {
            console.error(`An unknown error occurred while reading: ${filePath}`);
        }
        throw error;
    }
}

/**
 * Reads a JSON file synchronously and returns the parsed BufferInfo object.
 *
 * WARNING: This function blocks the main thread until I/O is complete.
 *
 * @param {string} filePath - The path to the JSON file to read.
 * @returns {BufferInfo} - The parsed BufferInfo object.
 * @throws {Error} - Throws an error if file reading or parsing fails.
 */
export function loadBufferInfoSync(filePath: string): BufferInfo[] {
    try {
        // fs.readFileSync returns a Buffer by default, so we specify 'utf8' to get a string.
        const data = fs.readFileSync(filePath, 'utf8');

        // Use 'as BufferInfo' to inform TypeScript of the expected shape after parsing.
        const bufferInfo = JSON.parse(data) as BufferInfo[];
        return bufferInfo;
    } catch (error) {
        if (error instanceof Error) {
            console.error(`Error reading or parsing JSON file synchronously: ${filePath}`, error.message);
        } else {
            console.error(`An unknown error occurred while reading: ${filePath}`);
        }
        throw error;
    }
}
