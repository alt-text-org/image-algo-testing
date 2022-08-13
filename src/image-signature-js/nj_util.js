'use strict';

const nj = require('numjs')
const _ = require('underscore')

const arrayUtil = require('./array_util')

// https://github.com/numpy/numpy/blob/v1.10.1/numpy/lib/function_base.py#L1116-L1175
function diff(a, n, axis) {
    // default to
    n = n === undefined ? 1 : n
    if (n === 0) {
        return a
    }
    if (n < 0) {
        throw new Error('order must be non-negative but got ' + n)
    }

    let nd = a.shape.length
    let slice1 = _.map(_.range(nd), el => [null])
    let slice2 = _.map(_.range(nd), el => [null])
    // default to last axis
    axis = axis === undefined ? nd - 1 : axis
    slice1[axis] = 1
    slice2[axis] = [null, -1]
    if (n > 1) {
        return diff(a.slice(...slice1).subtract(a.slice(...slice2), n - 1, axis))
    } else {
        return a.slice(...slice1).subtract(a.slice(...slice2))
    }
}

function sum(a, axis) {
    if (axis === undefined) {
        return a.flatten().sum()
    }

    const nd = a.shape.length
    const axisLength = a.shape[axis]
    const sliceShape = a.shape.slice()
    sliceShape.splice(axis, 1)

    if (sliceShape.length === 0) {
        // get cumulative sum of array (splice to discard initial 0)
        return nj.array(arrayUtil.scanLeft(0, a.tolist(), (prev, curr) => prev + curr).slice(1))
    } else {
        let slice = _.map(_.range(nd), el => [null, null, null])

        let sumSlice = nj.zeros(sliceShape)
        // LOOP INVARIANT: sumSlice is the cum sum up to i on the axis
        for (let i = 0; i < axisLength; i++) {
            // slice array at i on the given axis
            slice[axis] = [i, i + 1]
            const row = a.slice(...slice).reshape(...sliceShape)
            sumSlice = sumSlice.add(row)
        }
        return sumSlice
    }
}


// TODO test for array rank > 2
function cumsum(a, axis) {
    if (axis === undefined) {
        return cumsum(a.flatten(), 0)
    }

    const nd = a.shape.length
    const axisLength = a.shape[axis]
    const sliceShape = a.shape.slice()
    sliceShape.splice(axis, 1)

    if (sliceShape.length === 0) {
        // get cumulative sum of array (splice to discard initial 0)
        return nj.array(arrayUtil.scanLeft(0, a.tolist(), (prev, curr) => prev + curr).slice(1))
    } else {
        let slice = _.map(_.range(nd), el => [null, null, null])

        const result = []
        let sumSlice = nj.zeros(sliceShape)
        // LOOP INVARIANT: result is the cum sum up to i on the axis
        for (let i = 0; i < axisLength; i++) {
            // slice array at i on the given axis
            slice[axis] = [i, i + 1]
            const row = a.slice(...slice).reshape(...sliceShape)
            sumSlice = sumSlice.add(row)
            // add the sum to the result array
            result.push(sumSlice.tolist())
        }
        const axes = _.range(0, a.shape.length)
        axes[0] = axis
        axes[axis] = 0
        return nj.array(result).transpose(axes)
    }
}

// http://stackoverflow.com/questions/22697936/binary-search-in-javascript
function searchsorted(a, v) {
    let m = 0;
    let n = a.shape[0] - 1
    while (m <= n) {
        const k = (n + m) >> 1
        const cmp = v - a.get(k)
        if (cmp > 0) {
            m = k + 1
        } else if (cmp < 0) {
            n = k - 1
        } else {
            return k
        }
    }
    return m
}

function vectorize(a, fun) {
    return nj.array(_.map(a.flatten().tolist(), fun)).reshape(...a.shape)
}

// lowerOffset is negative
function getNeighbors(a, r, c, lowerOffset, upperOffset, includeSelf) {
    const clipRow = _.partial(clip, 0, a.shape[0] - 1)
    const clipColumn = _.partial(clip, 0, a.shape[1] - 1)

    if (includeSelf) {
        const rowSlice = [clipRow(r + lowerOffset), clipRow(r + upperOffset) + 1]
        const columnSlice = [clipColumn(c + lowerOffset), clipColumn(c + upperOffset) + 1]
        const neighbors = a.slice(rowSlice, columnSlice).flatten().tolist()
        return nj.array(neighbors)
    } else {
        // get slices for upper, left, right, and lower partitions without SELF
        /*  [     UPPER       ]
         *  [LEFT] SELF [RIGHT]
         *  [     LOWER       ]
         */
        const upperRowSlice = [clipRow(r + lowerOffset), r]
        const upperColumnSlice = [clipColumn(c + lowerOffset), clipColumn(c + upperOffset) + 1]

        const leftRowSlice = [r, r + 1]
        const leftColumnSlice = [clipColumn(c + lowerOffset), c]

        const rightRowSlice = [r, r + 1]
        const rightColumnSlice = [c + 1, clipColumn(c + upperOffset) + 1]

        const lowerRowSlice = [r + 1, clipRow(r + upperOffset) + 1]
        const lowerColumnSlice = [clipColumn(c + lowerOffset), clipColumn(c + upperOffset) + 1]

        const rowSlices = [upperRowSlice, leftRowSlice, rightRowSlice, lowerRowSlice]
        const columnSlices = [upperColumnSlice, leftColumnSlice, rightColumnSlice, lowerColumnSlice]

        const neighborGroups = arrayUtil.flatMap(_.zip(rowSlices, columnSlices), ([rowSlice, columnSlice]) => a.slice(rowSlice, columnSlice).flatten().tolist())
        const neighbors = arrayUtil.flatten(neighborGroups)
        return nj.array(neighbors)
    }
}

function sort(a) {
    const arr = a.flatten().tolist()
    arr.sort()
    return nj.array(arr)
}

function percentile(a, q) {
    const sorted = sort(a.flatten())
    const rank = q / 100 * (sorted.shape[0] + 1) - 1
    if (Number.isInteger(rank)) {
        if (sorted.get(rank) === undefined) {
            return null
        } else {
            return sorted.get(rank)
        }
    } else {
        const IR = Math.floor(rank)
        const FR = rank - IR
        const lower = sorted.get(IR)
        const upper = sorted.get(IR + 1)
        if (lower === undefined && upper === undefined) {
            return null
        } else if (lower === undefined) {
            return upper
        } else if (upper === undefined) {
            return lower
        } else {
            const interpolated = FR * (upper - lower) + lower
            return interpolated
        }
    }
}

const l2Norm = arr => Math.sqrt(vectorize(arr, x => Math.pow(x, 2)).sum())

const distance = (a1, a2) => l2Norm(a1.subtract(a2)) / (l2Norm(a1) + l2Norm(a2))

exports.diff = diff
exports.sum = sum
exports.cumsum = cumsum
exports.searchsorted = searchsorted
exports.vectorize = vectorize
exports.getNeighbors = getNeighbors
exports.sort = sort
exports.percentile = percentile
exports.l2Norm = l2Norm
exports.distance = distance

function clip(start, end, value) {
    if (value < start) {
        return start
    } else if (value > end) {
        return end
    } else {
        return value
    }
}

