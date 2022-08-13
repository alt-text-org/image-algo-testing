'use strict';

const _ = require('underscore')

function flatMap(arr, fun) {
    return Array.prototype.concat.apply([], arr.map(fun))
}

const flatten = arr => [].concat.apply([], arr)

function sliding(arr, groupSize, increment) {
    let result = []
    for (let i = 0; i < arr.length; i += increment) {
        let group = arr.slice(i, i + groupSize)
        result.push(group)
    }
    return result
}

// produces a collection containing cumulative results of applying the operator going left to right
function scanLeft(initial, arr, operator) {
    const newArray = [initial]
    _.reduce(arr, (memo, el) => {
        const result = operator(memo, el)
        newArray.push(result)
        return result
    }, initial)
    return newArray
}


exports.flatMap = flatMap
exports.flatten = flatten
exports.sliding = sliding
exports.scanLeft = scanLeft
