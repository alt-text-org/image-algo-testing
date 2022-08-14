const {shrinkImage, toGreyscale} = require("../common")
/**
 * This is copied from https://github.com/Sherryer/dct2, which is distributed under an MIT license
 *
 * It has been modified to memoize calls to Math.cos()
 */

const Hash = {};
const Cosines = {};

const cosine = (first, second, len) => {
    if (!Cosines[len]) {
        Cosines[len] = {};
    }
    let lenCosines = Cosines[len]

    if (!lenCosines[first]) {
        Cosines[len][first] = {};
    }
    let lenFirstCosines = Cosines[len][first]

    if (!lenFirstCosines[second]) {
        Cosines[len][first][second] = Math.cos((2 * first + 1) * Math.PI * second / 2 / len)
    }

    return lenFirstCosines[second];
}

const getCoff = (index, length) => {
    if (!Hash[length]) {
        let coff = [];
        coff[0] = 1 / Math.sqrt(length);
        for (let i = 1; i < length; i++) {
            coff[i] = Math.sqrt(2) / Math.sqrt(length);
        }
        Hash[length] = coff;
    }
    return Hash[length][index];
};

const DCT = (signal) => {
    const length = signal.length;
    let tmp = Array(length * length).fill(0);
    let res = Array(length).fill('').map(() => []);
    for (let i = 0; i < length; i++) {
        for (let j = 0; j < length; j++) {
            for (let x = 0; x < length; x++) {
                tmp[i * length + j] += getCoff(j, length) * signal[i][x] * cosine(x, j, length);
            }
        }
    }
    for (let i = 0; i < length; i++) {
        for (let j = 0; j < length; j++) {
            for (let x = 0; x < length; x++) {
                res[i][j] = (res[i][j] || 0) + getCoff(i, length) * tmp[x * length + j] * cosine(x, i, length)
            }
        }
    }
    return res
};

// End copied code

const diagonalSnake = (matrix, rows, cols) => {
    const result = new Array(rows * cols);
    let resultIdx = 0;
    for (let line = 1; line <= (rows + cols - 1); line++) {
        let start_col = Math.max(0, line - rows);
        let count = Math.min(line, (cols - start_col), rows);
        for (let j = 0; j < count; j++) {
            result[resultIdx] = matrix[Math.min(rows, line) - j - 1][start_col + j];
            resultIdx++;
        }
    }

    return result
}

function getTopLeft(pixels, edgeLength) {
    let res = Array(edgeLength).fill('').map(() => []);

    for (let row = 0; row < edgeLength; row++) {
        for (let col = 0; col < edgeLength; col++) {
            res[row][col] = pixels[row][col];
        }
    }

    return res;
}

function toMatrix(arr, rows, cols) {
    if (arr.length !== rows * cols) {
        throw new Error("Array length must equal requested rows * columns")
    }

    const matrix = [];
    for (let i = 0; i < rows; i++) {
        matrix[i] = [];
        for (let j = 0; j < cols; j++) {
            matrix[i][j] = arr[(i * cols) + j];
        }
    }

    return matrix;
}

async function dct1024Image(image, imageData) {
    let shrunk = shrinkImage(image, imageData, 64);
    let greyed = toGreyscale(shrunk);
    let matrix = toMatrix(greyed, 64, 64)
    let dct = DCT(matrix);
    let trimmed = getTopLeft(dct, 32);
    return diagonalSnake(trimmed, 32, 32)
}

exports.dct1024Image = dct1024Image; 