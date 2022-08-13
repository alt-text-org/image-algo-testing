const fs = require("fs")

const {createCanvas, loadImage} = require('canvas')

const {sha256} = require("./src/sha256")
const {pHash1024} = require("./src/phash/phash")
const {dct1024} = require("./src/dct/dct")
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


function run(name, metric, sourceFolder, handler, pineconeUrl) {
    const pinecone = makePineconeClient(pineconeApiKey, pineconeUrl)

    fs.readdir(sourceFolder, async (err, files) => {
        const vectors = {}
        const promises = []

        for (let file of files) {
            promises.push(loadImage(`${sourceFolder}/${file}`).then(async (image) => {
                const canvas = createCanvas(image.width, image.height)
                const ctx = canvas.getContext('2d')
                ctx.drawImage(image, 0, 0, image.width, image.height)
                const imageData = ctx.getImageData(0, 0, image.width, image.height)

                const vector = handler(image, imageData)
                const sha = sha256(imageData)

                vectors[sha] = vector;
                return await pinecone.upsert(sha, vector)
            }).catch(err => {
                console.error(err)
                return false
            }))
        }

        const inserted = await Promise.all(promises)
        console.log(`Inserted all: ${inserted.reduce((a,b) => a && b, true)}`)

        let returnedOver90 = [];
        let returnedOver95 = [];
        let returnedOver99 = [];
        let returnedOver999 = [];
        let topIsCorrect = [];

        for (const [sha, vector] of Object.entries(vectors)) {
            const results = await pinecone.query(vector, 10);
            returnedOver90.push(countMatchesOver(results, 0.90))
            returnedOver95.push(countMatchesOver(results, 0.95))
            returnedOver99.push(countMatchesOver(results, 0.99))
            returnedOver999.push(countMatchesOver(results, 0.999))

            if (results.length > 0) {
                topIsCorrect.push(results[0].sha256 === sha)
            }
        }

        returnedOver90 = returnedOver90.sort()
        returnedOver95 = returnedOver95.sort()
        returnedOver99 = returnedOver99.sort()
        returnedOver999 = returnedOver999.sort()

        console.log("Similarity Function,Distance Metric,Top Result Correct")
        console.log(`${name},${metric},${correctPct(topIsCorrect) * 100}%`)
        console.log("Count of #,Average,Minimum,25th Percentile,50th Percentile,75th Percentile,90th Percentile,95th Percentile,99th Percentile,99.9th Percentile,Max")
        console.log(`Returned with score > 0.90,${average(returnedOver90)},${returnedOver90[0]},${getQuantile(returnedOver90, 0.25)},${getQuantile(returnedOver90, 0.50)},${getQuantile(returnedOver90, 0.75)},${getQuantile(returnedOver90, 0.9)},${getQuantile(returnedOver90, 0.95)},${getQuantile(returnedOver90, 0.99)},${getQuantile(returnedOver90, 0.999)},${returnedOver90[returnedOver90.length - 1]}`)
        console.log(`Returned with score > 0.95,${average(returnedOver95)},${returnedOver95[0]},${getQuantile(returnedOver95, 0.25)},${getQuantile(returnedOver95, 0.50)},${getQuantile(returnedOver95, 0.75)},${getQuantile(returnedOver95, 0.9)},${getQuantile(returnedOver95, 0.95)},${getQuantile(returnedOver95, 0.99)},${getQuantile(returnedOver95, 0.999)},${returnedOver95[returnedOver95.length - 1]}`)
        console.log(`Returned with score > 0.99,${average(returnedOver99)},${returnedOver99[0]},${getQuantile(returnedOver99, 0.25)},${getQuantile(returnedOver99, 0.50)},${getQuantile(returnedOver99, 0.75)},${getQuantile(returnedOver99, 0.9)},${getQuantile(returnedOver99, 0.95)},${getQuantile(returnedOver99, 0.99)},${getQuantile(returnedOver99, 0.999)},${returnedOver99[returnedOver99.length - 1]}`)
        console.log(`Returned with score > 0.999,${average(returnedOver999)},${returnedOver999[0]},${getQuantile(returnedOver999, 0.25)},${getQuantile(returnedOver999, 0.50)},${getQuantile(returnedOver999, 0.75)},${getQuantile(returnedOver999, 0.9)},${getQuantile(returnedOver999, 0.95)},${getQuantile(returnedOver999, 0.99)},${getQuantile(returnedOver999, 0.999)},${returnedOver999[returnedOver999.length - 1]}`)
    });
}

run("32x32 Intensity Matrix", "Cosine","./sample-images", intensity1024, "https://intensity-1024-cosine-b335ecb.svc.us-west1-gcp.pinecone.io")