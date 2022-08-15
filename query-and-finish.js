const {makePineconeClient} = require("./src/pinecone")
const {loadVectorGroups, outputResultCSV} = require("./src/common");

const pineconeApiKey = process.env.PINECONE_API_KEY
if (!pineconeApiKey) {
    throw new Error("Pinecone API key not found")
}

function countMatchesOver(matches, threshold) {
    return matches.filter(match => match.score > threshold).length
}

function correctPct(arr) {
    const correctCnt = arr.filter(b => b).length
    return (1.0 * correctCnt) / arr.length
}

async function getResults(name, pinecone, metric, vectorGroups) {
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

    let numQueried = 0;
    const toQuery = Object.keys(vectorGroups).length
    for (const [sha, vectorGroup] of Object.entries(vectorGroups)) {
        await query(vectorGroup.same, sha, sameReturnedOver90, sameReturnedOver95, sameReturnedOver99, sameReturnedOver999, sameTopIsCorrect)
        await query(vectorGroup.cropped, sha, croppedReturnedOver90, croppedReturnedOver95, croppedReturnedOver99, croppedReturnedOver999, croppedTopIsCorrect)
        await query(vectorGroup.grown, sha, grownReturnedOver90, grownReturnedOver95, grownReturnedOver99, grownReturnedOver999, grownTopIsCorrect)
        await query(vectorGroup.shrunk, sha, shrunkReturnedOver90, shrunkReturnedOver95, shrunkReturnedOver99, shrunkReturnedOver999, shrunkTopIsCorrect)
        await query(vectorGroup.reformatted, sha, reformattedReturnedOver90, reformattedReturnedOver95, reformattedReturnedOver99, reformattedReturnedOver999, reformattedTopIsCorrect)
        numQueried++
        console.error(`Queried ${metric} for ${numQueried}/${toQuery}`)
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

    console.log("Similarity Function,Distance Metric,Top Result Correct - Same,Top Result Correct - Cropped,Top Result Correct - 2x Size,Top Result Correct - 1/2x Size, Top Result Correct - Reformatted")
    console.log(`${name},${metric},${correctPct(sameTopIsCorrect) * 100}%,${correctPct(croppedTopIsCorrect) * 100}%,${correctPct(grownTopIsCorrect) * 100}%,${correctPct(shrunkTopIsCorrect) * 100}%,${correctPct(reformattedTopIsCorrect) * 100}%`)
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

async function run(vectorFile, pineconeUrls) {
    const start = Date.now()
    const pinecones = {
        Cosine: makePineconeClient(pineconeApiKey, pineconeUrls.Cosine),
        Euclidean: makePineconeClient(pineconeApiKey, pineconeUrls.Euclidean),
        DotProduct: makePineconeClient(pineconeApiKey, pineconeUrls.DotProduct)
    }

    const vectorGroups = await loadVectorGroups(vectorFile)

    for (let [metric, pinecone] of Object.entries(pinecones)) {
        await getResults(name, pinecone, metric, vectorGroups)
    }

    console.error(`Finished in ${Date.now() - start}ms`)
}

const pineconeUrls = {
    Cosine: "https://dct-1024-cosine-b335ecb.svc.us-west1-gcp.pinecone.io",
    DotProduct: "https://dct-1024-dot-b335ecb.svc.us-west1-gcp.pinecone.io",
    Euclidean: "https://dct-1024-euclid-b335ecb.svc.us-west1-gcp.pinecone.io"
}

run("DCT-vectors-1660528334395.json", pineconeUrls)