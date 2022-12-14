const {createCanvas, loadImage} = require("canvas");
const fs = require("fs")
const JSONStream = require("JSONStream");

function shrinkImage(image, imageData, edgeLength) {
    let canvas = createCanvas(edgeLength, edgeLength)

    let ctx = canvas.getContext("2d");

    ctx.drawImage(image, 0, 0, imageData.width, imageData.height, 0, 0, edgeLength, edgeLength)
    return ctx.getImageData(0, 0, edgeLength, edgeLength);
}

function toGreyscale(imageData) {
    let rgba = new Uint8Array(imageData.data.buffer);
    let greyscale = new Uint8Array(rgba.length / 4);
    for (let i = 0, j = 0; i < rgba.length; i += 4, j++) {
        let intensity = (rgba[i] + rgba[i + 1] + rgba[i + 2]) * (rgba[i + 3] / 255.0);
        greyscale[j] = Math.round((intensity / 765) * 255);
    }

    return greyscale;
}

async function loadVectorGroups(file) {
    return new Promise((resolve, reject) => {
        const jsonStream = JSONStream.parse([{emitKey: true}]);
        const readableStream = fs.createReadStream(file, 'utf8').pipe(jsonStream);

        readableStream.on('error', function (error) {
            reject(error)
        })

        const result = {}
        jsonStream.on('data', function(data) {
            result[data.key] = data.value
        });

        jsonStream.on('close', () => resolve(result))
    })
}

function average(arr) {
    const sum = arr.reduce((a, b) => a + b, 0)
    return (1.0 * sum) / arr.length
}

function getQuantile(arr, quantile) {
    const idx = Math.floor(arr.length * quantile)
    return arr[idx]
}

function outputResultCSV(name, arr) {
    console.log(
        `${name},` +
        `${average(arr)},` +
        `${arr[0]},` +
        `${getQuantile(arr, 0.25)},` +
        `${getQuantile(arr, 0.50)},` +
        `${getQuantile(arr, 0.75)},` +
        `${getQuantile(arr, 0.90)},` +
        `${getQuantile(arr, 0.95)},` +
        `${getQuantile(arr, 0.99)},` +
        `${getQuantile(arr, 0.999)},` +
        `${arr[arr.length - 1]}`
    )
}

async function loadImageFile(path) {
    const image = await loadImage(path)
    const canvas = createCanvas(image.width, image.height)
    const ctx = canvas.getContext('2d')
    ctx.drawImage(image, 0, 0, image.width, image.height)
    const imageData = ctx.getImageData(0, 0, image.width, image.height)

    return {
        image: image,
        imageData: imageData
    }
}

exports.shrinkImage = shrinkImage;
exports.toGreyscale = toGreyscale;
exports.loadVectorGroups = loadVectorGroups;
exports.average = average;
exports.getQuantile = getQuantile;
exports.outputResultCSV = outputResultCSV;
exports.loadImageFile = loadImageFile;