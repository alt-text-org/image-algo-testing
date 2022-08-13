const fs = require("fs")

const {createCanvas, loadImage} = require('canvas')

const {sha256} = require("./src/sha256")
const {pHash1024} = require("./src/phash/phash")
const {dct1024} = require("./src/dct/dct")
const {intensity1024} = require("./src/intensity/intensity")
const {goldberg} = require("./src/image-signature-js/image_signature")
const {makePineconeClient} = require("./src/pinecone")
const {cropImage, scaleImage} = require("./src/common")

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

function run(name, metric, sourceFolder, handler, pineconeUrl) {
    const pinecone = makePineconeClient(pineconeApiKey, pineconeUrl)
    const start = Date.now()
    const tweakImageTimes = []
    const vectorCalcTimes = []
    const upsertTimes = []
    const queryTimes = []

    fs.readdir(sourceFolder, async (err, files) => {
        const vectorGroups = {}
        const promises = []

        for (let file of files) {
            promises.push(loadImage(`${sourceFolder}/${file}`).then(async (image) => {
                const canvas = createCanvas(image.width, image.height)
                const ctx = canvas.getContext('2d')
                ctx.drawImage(image, 0, 0, image.width, image.height)
                const imageData = ctx.getImageData(0, 0, image.width, image.height)

                const tweakStart = Date.now()
                const {croppedImage, croppedImageData} = await cropImage(image, imageData, 0.90)
                const grown = await scaleImage(image, imageData, 2)
                const shrunk = await scaleImage(image, imageData, 0.5)
                tweakImageTimes.push(Date.now() - tweakStart)

                const vectorCalcStart = Date.now()
                const vectorGroup = {
                    same: await handler(image, imageData),
                    cropped: await handler(croppedImage, croppedImageData),
                    grown: await handler(grown.scaledImage, grown.scaledImageData),
                    shrunk: await handler(shrunk.scaledImage, shrunk.scaledImageData)
                }
                vectorCalcTimes.push(Date.now() - vectorCalcStart)
                const sha = sha256(imageData)

                vectorGroups[sha] = vectorGroup;

                const upsertStart = Date.now()
                const upsertSuccess = await pinecone.upsert(sha, vectorGroup.same)
                upsertTimes.push(Date.now() - upsertStart)

                return upsertSuccess
            }).catch(err => {
                console.error(err)
                return false
            }))
        }

        const inserted = await Promise.all(promises)
        console.log(`Inserted all: ${inserted.reduce((a, b) => a && b, true)}`)

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

        const query = async (vector, sha, returnedOver90, returnedOver95, returnedOver99, returnedOver999, topIsCorrect) => {
            const queryStart = Date.now()
            const results = await pinecone.query(vector, 10);
            queryTimes.push(Date.now() - queryStart)

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

        tweakImageTimes.sort((a, b) => a - b)
        vectorCalcTimes.sort((a, b) => a - b)
        upsertTimes.sort((a, b) => a - b)
        queryTimes.sort((a, b) => a - b)

        console.log(`Finished in ${Date.now() - start}ms`)
        console.log()

        console.log("Similarity Function,Distance Metric,Top Result Correct - Same,Top Result Correct - Cropped,Top Result Correct - 2x Size,Top Result Correct - 1/2x Size")
        console.log(`${name},${metric},${correctPct(sameTopIsCorrect) * 100}%,${correctPct(croppedTopIsCorrect) * 100}%,${correctPct(grownTopIsCorrect) * 100}%,${correctPct(shrunkTopIsCorrect) * 100}%`)
        console.log()

        console.log("Timing,Average,Minimum,25th Percentile,50th Percentile,75th Percentile,90th Percentile,95th Percentile,99th Percentile,99.9th Percentile,Max")
        outputResultCSV("Tweak Image", tweakImageTimes)
        outputResultCSV("Calculate Vectors", vectorCalcTimes)
        outputResultCSV("Upsert Vectors", upsertTimes)
        outputResultCSV("Query Vectors", queryTimes)
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
    });
}

run("32x32 Intensity Matrix", "Cosine", "./sample-images", intensity1024, "https://intensity-1024-cosine-b335ecb.svc.us-west1-gcp.pinecone.io")