const fs = require("fs")

const {createCanvas, loadImage} = require('canvas')

const {sha256} = require("./src/sha256")
const {pHash1024} = require("./src/phash/phash")
const {dct1024Image} = require("./src/dct/dct")
const {intensity1024} = require("./src/intensity/intensity")
const {goldberg} = require("./src/image-signature-js/image_signature")
const {makePineconeClient} = require("./src/pinecone")

const pineconeApiKey = process.env.PINECONE_API_KEY
if (!pineconeApiKey) {
    throw new Error("Pinecone API key not found")
}

function countMatchesOver(matches, threshold) {
    return matches.filter(match => match.score > threshold).length
}

function average(arr) {
    const sum = arr.reduce((a, b) => a + b, 0)
    return (1.0 * sum) / arr.length
}

function getQuantile(arr, quantile) {
    const idx = Math.floor(arr.length * quantile)
    return arr[idx]
}

function correctPct(arr) {
    const correctCnt = arr.filter(b => b).length
    return (1.0 * correctCnt) / arr.length
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

async function getResults(name, pinecone, metric, vectorGroups, vectorCalcTimes) {
    const sameReturnedOver90 = [];
    const sameReturnedOver95 = [];
    const sameReturnedOver99 = [];
    const sameReturnedOver999 = [];
    const sameTopIsCorrect = [];

    const croppedReturnedOver90 = [];
    const croppedReturnedOver95 = [];
    const croppedReturnedOver99 = [];
    const croppedReturnedOver999 = [];
    const croppedTopIsCorrect = [];

    const grownReturnedOver90 = [];
    const grownReturnedOver95 = [];
    const grownReturnedOver99 = [];
    const grownReturnedOver999 = [];
    const grownTopIsCorrect = [];

    const shrunkReturnedOver90 = [];
    const shrunkReturnedOver95 = [];
    const shrunkReturnedOver99 = [];
    const shrunkReturnedOver999 = [];
    const shrunkTopIsCorrect = [];

    const reformattedReturnedOver90 = [];
    const reformattedReturnedOver95 = [];
    const reformattedReturnedOver99 = [];
    const reformattedReturnedOver999 = [];
    const reformattedTopIsCorrect = [];

    const query = async (vector, sha, returnedOver90, returnedOver95, returnedOver99, returnedOver999, topIsCorrect) => {
        const results = await pinecone.query(vector, 10);

        returnedOver90.push(countMatchesOver(results, 0.90))
        returnedOver95.push(countMatchesOver(results, 0.95))
        returnedOver99.push(countMatchesOver(results, 0.99))
        returnedOver999.push(countMatchesOver(results, 0.999))

        if (results.length > 0) {
            topIsCorrect.push(results[0].sha256 === sha)
        }
    }

    for (const [sha, vectorGroup] of Object.entries(vectorGroups)) {
        await query(vectorGroup.same, sha, sameReturnedOver90, sameReturnedOver95, sameReturnedOver99, sameReturnedOver999, sameTopIsCorrect)
        await query(vectorGroup.cropped, sha, croppedReturnedOver90, croppedReturnedOver95, croppedReturnedOver99, croppedReturnedOver999, croppedTopIsCorrect)
        await query(vectorGroup.grown, sha, grownReturnedOver90, grownReturnedOver95, grownReturnedOver99, grownReturnedOver999, grownTopIsCorrect)
        await query(vectorGroup.shrunk, sha, shrunkReturnedOver90, shrunkReturnedOver95, shrunkReturnedOver99, shrunkReturnedOver999, shrunkTopIsCorrect)
        await query(vectorGroup.reformatted, sha, reformattedReturnedOver90, reformattedReturnedOver95, reformattedReturnedOver99, reformattedReturnedOver999, reformattedTopIsCorrect)
    }

    sameReturnedOver90.sort((a, b) => a - b)
    sameReturnedOver95.sort((a, b) => a - b)
    sameReturnedOver99.sort((a, b) => a - b)
    sameReturnedOver999.sort((a, b) => a - b)

    croppedReturnedOver90.sort((a, b) => a - b)
    croppedReturnedOver95.sort((a, b) => a - b)
    croppedReturnedOver99.sort((a, b) => a - b)
    croppedReturnedOver999.sort((a, b) => a - b)

    grownReturnedOver90.sort((a, b) => a - b)
    grownReturnedOver95.sort((a, b) => a - b)
    grownReturnedOver99.sort((a, b) => a - b)
    grownReturnedOver999.sort((a, b) => a - b)

    shrunkReturnedOver90.sort((a, b) => a - b)
    shrunkReturnedOver95.sort((a, b) => a - b)
    shrunkReturnedOver99.sort((a, b) => a - b)
    shrunkReturnedOver999.sort((a, b) => a - b)

    reformattedReturnedOver90.sort((a, b) => a - b)
    reformattedReturnedOver95.sort((a, b) => a - b)
    reformattedReturnedOver99.sort((a, b) => a - b)
    reformattedReturnedOver999.sort((a, b) => a - b)

    vectorCalcTimes.sort((a, b) => a - b)

    console.log("Similarity Function,Distance Metric,Top Result Correct - Same,Top Result Correct - Cropped,Top Result Correct - 2x Size,Top Result Correct - 1/2x Size, Top Result Correct - Reformatted")
    console.log(`${name},${metric},${correctPct(sameTopIsCorrect) * 100}%,${correctPct(croppedTopIsCorrect) * 100}%,${correctPct(grownTopIsCorrect) * 100}%,${correctPct(shrunkTopIsCorrect) * 100}%,${correctPct(reformattedTopIsCorrect) * 100}%`)
    console.log()

    console.log("Timing,Average,Minimum,25th Percentile,50th Percentile,75th Percentile,90th Percentile,95th Percentile,99th Percentile,99.9th Percentile,Max")
    outputResultCSV("Calculate Vectors", vectorCalcTimes)
    console.log()

    console.log("Category,Average,Minimum,25th Percentile,50th Percentile,75th Percentile,90th Percentile,95th Percentile,99th Percentile,99.9th Percentile,Max")
    outputResultCSV("Same - Score > 0.90", sameReturnedOver90)
    outputResultCSV("Same - Score > 0.95", sameReturnedOver95)
    outputResultCSV("Same - Score > 0.99", sameReturnedOver99)
    outputResultCSV("Same - Score > 0.999", sameReturnedOver999)

    outputResultCSV("Cropped - Score > 0.90", croppedReturnedOver90)
    outputResultCSV("Cropped - Score > 0.95", croppedReturnedOver95)
    outputResultCSV("Cropped - Score > 0.99", croppedReturnedOver99)
    outputResultCSV("Cropped - Score > 0.999", croppedReturnedOver999)

    outputResultCSV("Grown - Score > 0.90", grownReturnedOver90)
    outputResultCSV("Grown - Score > 0.95", grownReturnedOver95)
    outputResultCSV("Grown - Score > 0.99", grownReturnedOver99)
    outputResultCSV("Grown - Score > 0.999", grownReturnedOver999)

    outputResultCSV("Shrunk - Score > 0.90", shrunkReturnedOver90)
    outputResultCSV("Shrunk - Score > 0.95", shrunkReturnedOver95)
    outputResultCSV("Shrunk - Score > 0.99", shrunkReturnedOver99)
    outputResultCSV("Shrunk - Score > 0.999", shrunkReturnedOver999)

    outputResultCSV("Reformatted - Score > 0.90", reformattedReturnedOver90)
    outputResultCSV("Reformatted - Score > 0.95", reformattedReturnedOver95)
    outputResultCSV("Reformatted - Score > 0.99", reformattedReturnedOver99)
    outputResultCSV("Reformatted - Score > 0.999", reformattedReturnedOver999)
}

function run(name, sourceFolder, vectorizer, pineconeUrls) {
    const pinecones = {
        Cosine: makePineconeClient(pineconeApiKey, pineconeUrls.Cosine),
        Euclidean: makePineconeClient(pineconeApiKey, pineconeUrls.Euclidean),
        DotProduct: makePineconeClient(pineconeApiKey, pineconeUrls.DotProduct)
    }

    const start = Date.now()
    const vectorCalcTimes = []

    fs.readdir(sourceFolder, async (err, files) => {
        const vectorGroups = {}
        const promises = []

        for (let file of files.filter(f => f.match(/.*jpg/))) {
            console.error(`Processing ${file}`)
            const {image, imageData} = await loadImageFile(`${sourceFolder}/${file}`)
            const {image: shrunkImage, imageData: shrunkImageData} = await loadImageFile(`${sourceFolder}/shrunk/${file}`)
            const {image: grownImage, imageData: grownImageData} = await loadImageFile(`${sourceFolder}/grown/${file}`)
            const {image: croppedImage, imageData: croppedImageData} = await loadImageFile(`${sourceFolder}/cropped/${file}`)
            const {image: reformattedImage, imageData: reformattedImageData} = await loadImageFile(`${sourceFolder}/reformatted/${file.replace('jpg', 'png')}`)

            const vectorCalcStart = Date.now()
            const vectorGroup = {
                same: await vectorizer(image, imageData),
                cropped: await vectorizer(croppedImage, croppedImageData),
                grown: await vectorizer(grownImage, grownImageData),
                shrunk: await vectorizer(shrunkImage, shrunkImageData),
                reformatted: await vectorizer(reformattedImage, reformattedImageData)
            }
            vectorCalcTimes.push(Date.now() - vectorCalcStart)
            const sha = sha256(imageData)

            vectorGroups[sha] = vectorGroup;
            promises.push((async () => {
                const results = await Promise.all(Object.values(pinecones).map(pc => pc.upsert(sha, vectorGroup.same)))
                return results.reduce((a, b) => a && b, true)
            })())
        }

        const inserted = await Promise.all(promises)
        console.log(`Inserted all: ${inserted.reduce((a, b) => a && b, true)}`)

        for (let [metric, pinecone] of Object.entries(pinecones)) {
            await getResults(name, pinecone, metric, vectorGroups, vectorCalcTimes)
        }

        console.log(`Finished in ${Date.now() - start}ms`)
        console.log()
    });
}

const pineconeUrls = {
    Cosine: "https://goldberg-544-cosine-b335ecb.svc.us-west1-gcp.pinecone.io",
    DotProduct: "https://goldberg-544-dot-b335ecb.svc.us-west1-gcp.pinecone.io",
    Euclidean: "https://goldberg-544-euclid-b335ecb.svc.us-west1-gcp.pinecone.io"
}

run("Goldberg","./images", goldberg, pineconeUrls)
