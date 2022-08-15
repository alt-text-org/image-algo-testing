const fs = require("fs")

const JSONStream = require("JSONStream")

const {sha256} = require("./src/sha256")
const {pHash1024} = require("./src/phash/phash")
const {dct1024Image} = require("./src/dct/dct")
const {intensity1024} = require("./src/intensity/intensity")
const {goldberg} = require("./src/image-signature-js/image_signature")
const {loadImageFile} = require("./src/common");

function run(name, sourceFolder, vectorizer) {
    fs.readdir(sourceFolder, async (err, files) => {
        const vectorGroups = {}

        for (let file of files.filter(f => f.match(/.*jpg/))) {
            console.error(`${name}: Processing ${file}`)
            const {image, imageData} = await loadImageFile(`${sourceFolder}/${file}`)

            const vectorGroup = {
                file: file,
                same: await vectorizer(image, imageData),
            }

            const sha = sha256(imageData)
            vectorGroups[sha] = vectorGroup;
        }

        const jsonStream = JSONStream.stringifyObject();
        const outputStream = fs.createWriteStream(`missing-${name}-vectors-${Date.now()}.json`);
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
    });
}

run("Goldberg","./missing-images", goldberg)
run("DCT", "./missing-images", dct1024Image)
run("Intensity", "./missing-images", intensity1024)
run("pHash", "./missing-images", pHash1024)
