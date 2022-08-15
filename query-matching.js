const {makePineconeClient} = require("./src/pinecone")
const {loadVectorGroups, outputResultCSV} = require("./src/common");

const pineconeApiKey = process.env.PINECONE_API_KEY
if (!pineconeApiKey) {
    throw new Error("Pinecone API key not found")
}

function pctTrue(arr) {
    const correctCnt = arr.filter(b => b).length
    return (1.0 * correctCnt) / arr.length
}

function correctScore(sha, matches) {
    const sameSha = matches.filter(match => match.sha256 === sha)

    if (sameSha.length > 0) {
        return sameSha[0].score
    } else {
        return null
    }
}

function highestIncorrectScore(sha, matches) {
    for (let match of matches) {
        if (match.sha256 !== sha) {
            return match.score
        }
    }

    return null;
}

function outputMatchingPctCSV(image, topIsCorrect, correctIsPresent) {
    console.log(`${image},${pctTrue(topIsCorrect)},${pctTrue(correctIsPresent)}`)
}

async function getResults(name, pinecone, metric, vectorGroups) {
    const sameMatchingScore = [];
    const sameHighestNonMatching = [];
    const sameCorrectPresent = [];
    const sameTopIsCorrect = [];

    const croppedMatchingScore = [];
    const croppedHighestNonMatching = [];
    const croppedCorrectPresent = [];
    const croppedTopIsCorrect = [];

    const grownMatchingScore = [];
    const grownHighestNonMatching = [];
    const grownCorrectPresent = [];
    const grownTopIsCorrect = [];

    const shrunkMatchingScore = [];
    const shrunkHighestNonMatching = [];
    const shrunkCorrectPresent = [];
    const shrunkTopIsCorrect = [];

    const reformattedMatchingScore = [];
    const reformattedHighestNonMatching = [];
    const reformattedCorrectPresent = [];
    const reformattedTopIsCorrect = [];

    const query = async (vector, sha, matchingScore, highestNonMatchingScore, topIsCorrect, correctPresent) => {
        const results = await pinecone.query(vector, 10);

        const cScore = correctScore(sha, results)
        if (cScore) {
            matchingScore.push(cScore)
            correctPresent.push(true)
        } else {
            correctPresent.push(false)
        }

        const highestIncorrect = highestIncorrectScore(sha, results)
        if (highestIncorrect) {
            highestNonMatchingScore.push(highestIncorrect)
        }

        if (results.length > 0) {
            topIsCorrect.push(results[0].sha256 === sha)
        }
    }

    let numQueried = 0;
    const toQuery = Object.keys(vectorGroups).length
    for (const [sha, vectorGroup] of Object.entries(vectorGroups)) {
        await query(vectorGroup.same, sha, sameMatchingScore, sameHighestNonMatching, sameTopIsCorrect, sameCorrectPresent)
        await query(vectorGroup.cropped, sha, croppedMatchingScore, croppedHighestNonMatching, croppedTopIsCorrect, croppedCorrectPresent)
        await query(vectorGroup.grown, sha, grownMatchingScore, grownHighestNonMatching, grownTopIsCorrect, grownCorrectPresent)
        await query(vectorGroup.shrunk, sha, shrunkMatchingScore, shrunkHighestNonMatching, shrunkTopIsCorrect, shrunkCorrectPresent)
        await query(vectorGroup.reformatted, sha, reformattedMatchingScore, reformattedHighestNonMatching, reformattedTopIsCorrect, reformattedCorrectPresent)
        numQueried++
        console.error(`${name}: Queried ${metric} for ${numQueried}/${toQuery}`)
    }

    sameMatchingScore.sort((a, b) => a - b)
    sameHighestNonMatching.sort((a, b) => a - b)
    croppedMatchingScore.sort((a, b) => a - b)
    croppedHighestNonMatching.sort((a, b) => a - b)
    grownMatchingScore.sort((a, b) => a - b)
    grownHighestNonMatching.sort((a, b) => a - b)
    shrunkMatchingScore.sort((a, b) => a - b)
    shrunkHighestNonMatching.sort((a, b) => a - b)
    reformattedMatchingScore.sort((a, b) => a - b)
    reformattedHighestNonMatching.sort((a, b) => a - b)

    console.log("Similarity Function,Distance Metric")
    console.log(`${name},${metric}`)
    console.log()

    console.log("Image,Top Correct, Correct Present")
    outputMatchingPctCSV("Same", sameTopIsCorrect, sameCorrectPresent)
    outputMatchingPctCSV("Cropped", croppedTopIsCorrect, croppedCorrectPresent)
    outputMatchingPctCSV("Grown", grownTopIsCorrect, grownCorrectPresent)
    outputMatchingPctCSV("Shrunk", shrunkTopIsCorrect, shrunkCorrectPresent)
    outputMatchingPctCSV("Reformatted", reformattedTopIsCorrect, reformattedCorrectPresent)
    console.log()

    console.log("Category,Average,Minimum,25th Percentile,50th Percentile,75th Percentile,90th Percentile,95th Percentile,99th Percentile,99.9th Percentile,Max")
    outputResultCSV("Same - Matching Score", sameMatchingScore)
    outputResultCSV("Same - Highest Non Matching", sameHighestNonMatching)
    outputResultCSV("Cropped - Matching Score", croppedMatchingScore)
    outputResultCSV("Cropped - Highest Non Matching", croppedHighestNonMatching)
    outputResultCSV("Grown - Matching Score", grownMatchingScore)
    outputResultCSV("Grown - Highest Non Matching", grownHighestNonMatching)
    outputResultCSV("Shrunk - Matching Score", shrunkMatchingScore)
    outputResultCSV("Shrunk - Highest Non Matching", shrunkHighestNonMatching)
    outputResultCSV("Reformatted - Matching Score", reformattedMatchingScore)
    outputResultCSV("Reformatted - Highest Non Matching", reformattedHighestNonMatching)
}

async function run(name, vectorFile, pineconeUrls) {
    const pinecones = {}
    for (let [metric, url] of Object.entries(pineconeUrls)) {
        pinecones[metric] = makePineconeClient(pineconeApiKey, url)
    }

    const vectorGroups = await loadVectorGroups(vectorFile)

    for (let [metric, pinecone] of Object.entries(pinecones)) {
        await getResults(name, pinecone, metric, vectorGroups)
    }
}

(async () => {
    const start = Date.now()
    const goldbergPineconeUrls = {
        Cosine: "https://goldberg-544-cosine-b335ecb.svc.us-west1-gcp.pinecone.io",
        DotProduct: "https://goldberg-544-dot-b335ecb.svc.us-west1-gcp.pinecone.io",
        Euclidean: "https://goldberg-544-euclid-b335ecb.svc.us-west1-gcp.pinecone.io"
    }
    await run("Goldberg", "Goldberg-vectors.json", goldbergPineconeUrls)

    const pHashPineconeUrls = {
        Cosine: "https://phash-1024-cosine-b335ecb.svc.us-west1-gcp.pinecone.io",
        Euclidean: "https://phash-1024-euclid-b335ecb.svc.us-west1-gcp.pinecone.io"
    }
    await run("pHash", "pHash-vectors-1660522856022.json", pHashPineconeUrls)

    const dctPineconeUrls = {
        Cosine: "https://dct-1024-cosine-b335ecb.svc.us-west1-gcp.pinecone.io",
        Euclidean: "https://dct-1024-euclid-b335ecb.svc.us-west1-gcp.pinecone.io"
    }
    await run("DCT", "DCT-vectors-1660528334395.json", dctPineconeUrls)

    const intensityPineconeUrls = {
        Cosine: "https://intensity-1024-cosine-b335ecb.svc.us-west1-gcp.pinecone.io",
        Euclidean: "https://intensity-1024-euclid-b335ecb.svc.us-west1-gcp.pinecone.io"
    }
    await run("Intensity", "Intensity-vectors-1660521980204.json", intensityPineconeUrls)

    console.error(`Finished in ${Date.now() - start}ms`)
})()

