const fs = require("fs")

const {createCanvas, loadImage} = require('canvas')
const JSONStream = require("JSONStream")

const {sha256} = require("./src/sha256")
const {pHash1024} = require("./src/phash/phash")
const {dct1024Image} = require("./src/dct/dct")
const {intensity1024} = require("./src/intensity/intensity")
const {goldberg} = require("./src/image-signature-js/image_signature")
const {outputResultCSV} = require("./src/common");

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

function run(name, sourceFolder, vectorizer) {
    const start = Date.now()
    const vectorCalcTimes = []

    fs.readdir(sourceFolder, async (err, files) => {
        const vectorGroups = {}

        for (let file of files.filter(f => f.match(/.*jpg/))) {
            console.error(`${name}: Processing ${file}`)
            const {image, imageData} = await loadImageFile(`${sourceFolder}/${file}`)
            const {image: shrunkImage, imageData: shrunkImageData} = await loadImageFile(`${sourceFolder}/shrunk/${file}`)
            const {image: grownImage, imageData: grownImageData} = await loadImageFile(`${sourceFolder}/grown/${file}`)
            const {image: croppedImage, imageData: croppedImageData} = await loadImageFile(`${sourceFolder}/cropped/${file}`)
            const {image: reformattedImage, imageData: reformattedImageData} = await loadImageFile(`${sourceFolder}/reformatted/${file.replace('jpg', 'png')}`)

            const vectorCalcStart = Date.now()
            const vectorGroup = {
                file: file,
                same: await vectorizer(image, imageData),
                cropped: await vectorizer(croppedImage, croppedImageData),
                grown: await vectorizer(grownImage, grownImageData),
                shrunk: await vectorizer(shrunkImage, shrunkImageData),
                reformatted: await vectorizer(reformattedImage, reformattedImageData)
            }
            vectorCalcTimes.push(Date.now() - vectorCalcStart)

            const sha = sha256(imageData)
            vectorGroups[sha] = vectorGroup;
        }

        const jsonStream = JSONStream.stringifyObject();
        const outputStream = fs.createWriteStream(`${name}-vectors-${Date.now()}.json`);
        jsonStream.pipe(outputStream)
        for (const [sha, vectorGroup] of Object.entries(vectorGroups)) {
            jsonStream.write([sha, vectorGroup])
        }
        jsonStream.end();

        outputStream.on(
            "finish",
            function handleFinish() {
                console.log("Done");
            }
        );


        vectorCalcTimes.sort((a, b) => a - b)
        console.error(`Finished in ${Date.now() - start}ms`)
        console.log("Timing,Average,Minimum,25th Percentile,50th Percentile,75th Percentile,90th Percentile,95th Percentile,99th Percentile,99.9th Percentile,Max")
        outputResultCSV(name, vectorCalcTimes)
    });
}

// run("Goldberg","./images", goldberg)
run("DCT", "./images", dct1024Image)
// run("Intensity", "./images", intensity1024)
// run("pHash", "./images", pHash1024)
