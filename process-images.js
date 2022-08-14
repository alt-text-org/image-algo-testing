const fs = require("fs")
const {createCanvas, loadImage} = require('canvas')

function scaleImage(image, imageData, scale) {
    const newWidth = Math.floor(image.width * scale)
    const newHeight = Math.floor(image.height * scale)
    let canvas = createCanvas(newWidth, newHeight)

    let ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0, imageData.width, imageData.height, 0, 0, newWidth, newHeight)

    return canvas
}

function cropImage(image, imageData, pct) {
    const newWidth = Math.floor(image.width * pct)
    const newHeight = Math.floor(image.height * pct)
    let canvas = createCanvas(image.width, image.height)
    let ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0, imageData.width, imageData.height)

    const newImageData = ctx.getImageData(Math.floor((image.width - newWidth) / 2), Math.floor((image.height - newHeight) / 2), newWidth, newHeight);

    const newCanvas = createCanvas(newImageData.width, newImageData.height);
    const newCtx = newCanvas.getContext('2d');
    newCtx.putImageData(newImageData, 0, 0);

    return newCanvas
}

function writeFile(path, mime, canvas) {
    console.log(`Writing: ${path}`)
    const buffer = canvas.toBuffer(mime)
    fs.writeFileSync(path, buffer)
}

function run(sourceFolder) {
    fs.readdir(sourceFolder, async (err, files) => {
        const promises = []
        for (let file of files.filter(f => f.match(/.*jpg/))) {
            promises.push(loadImage(`${sourceFolder}/${file}`).then(async (image) => {
                    const canvas = createCanvas(image.width, image.height)
                    const ctx = canvas.getContext('2d')
                    ctx.drawImage(image, 0, 0, image.width, image.height)
                    const imageData = ctx.getImageData(0, 0, image.width, image.height)

                    const cropped = cropImage(image, imageData, 0.90)
                    writeFile(`${sourceFolder}/cropped/${file}`, 'image/jpeg', cropped)

                    const grown = scaleImage(image, imageData, 2)
                    writeFile(`${sourceFolder}/grown/${file}`, 'image/jpeg', grown)

                    const shrunk = scaleImage(image, imageData, 0.5)
                    writeFile(`${sourceFolder}/shrunk/${file}`, 'image/jpeg', shrunk)

                    const pngFile = file.replace('jpg', 'png')
                    writeFile(`${sourceFolder}/reformatted/${pngFile}`, 'image/png', canvas)

                }).catch(err => {
                    console.log(err)
                    return false
                })
            )
        }

        await Promise.all(promises)
    });
}

run('./images')