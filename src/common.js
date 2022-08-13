const {createCanvas} = require("canvas");

function shrinkImage(image, imageData, edgeLength) {
    let canvas = createCanvas(edgeLength, edgeLength)

    let ctx = canvas.getContext("2d");

    ctx.drawImage(image, 0, 0, imageData.width, imageData.height, 0, 0, edgeLength, edgeLength)
    return ctx.getImageData(0, 0, edgeLength, edgeLength);
}

async function scaleImage(image, imageData, scale) {
    const newWidth = Math.floor(image.width * scale)
    const newHeight = Math.floor(image.height * scale)
    let canvas = createCanvas(newWidth, newHeight)

    let ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0, imageData.width, imageData.height, 0, 0, newWidth, newHeight)

    return new Promise(res => {
        const newImage = new Image();
        newImage.onload = () => {
            res({
                scaledImageData: ctx.getImageData(0, 0, newWidth, newHeight),
                scaledImage: newImage
            })
        }
        newImage.src = canvas.toDataURL();
    })
}

async function cropImage(image, imageData, pct) {
    const newWidth = Math.floor(image.width * pct)
    const newHeight = Math.floor(image.height * pct)
    let canvas = createCanvas(image.width, image.height)
    let ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0, imageData.width, imageData.height)

    const newImageData = ctx.getImageData(Math.floor((image.width - newWidth) / 2), Math.floor((image.height - newHeight) / 2), newWidth, newHeight);

    const newCanvas = createCanvas(newImageData.width, newImageData.height);
    const newCtx = newCanvas.getContext('2d');
    newCtx.putImageData(newImageData, 0, 0);

    return new Promise(res => {
        const newImage = new Image();
        newImage.onload = () => {
            res({
                croppedImage: newImage,
                croppedImageData: ctx.getImageData(0, 0, newWidth, newHeight)
            })
        }
        newImage.src = newCanvas.toDataURL();
    })
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

exports.shrinkImage = shrinkImage;
exports.toGreyscale = toGreyscale;
exports.scaleImage = scaleImage;
exports.cropImage = cropImage;