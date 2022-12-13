import shuffleSeed from 'shuffle-seed'

function unscrambleImg(img, sliceSize, seed, ctx) {
  const totalParts = Math.ceil(img.width / sliceSize) * Math.ceil(img.height / sliceSize)
  const inds = []
  for (let i = 0; i < totalParts; i++) { 
    inds.push(i)
  }

  const slices = getSlices(img, sliceSize)
  for (const g in slices) {
    const group = getGroup(slices[g])
    let shuffleInd = []
    for (let i = 0; i < slices[g].length; i++) {
      shuffleInd.push(i)
    }
    shuffleInd = shuffleSeed.shuffle(shuffleInd, seed)
    for (let i = 0; i < slices[g].length; i++) {
      const s = shuffleInd[i]
      const row = Math.floor(s / group.cols)
      const col = s - row * group.cols
      const x = col * slices[g][i].width
      const y = row * slices[g][i].height
      ctx.drawImage(
        img,
        group.x + x,
        group.y + y,
        slices[g][i].width,
        slices[g][i].height,
        slices[g][i].x,
        slices[g][i].y,
        slices[g][i].width,
        slices[g][i].height
      )
    }
  }
  return ctx
}

function getGroup(slices) {
  const self = {}
  self.slices = slices.length
  self.cols = getColsInGroup(slices)
  self.rows = slices.length / self.cols
  self.width = slices[0].width * self.cols
  self.height = slices[0].height * self.rows
  self.x = slices[0].x
  self.y = slices[0].y
  return self
}

function getSlices(img, sliceSize) {
  const totalParts = Math.ceil(img.width / sliceSize) * Math.ceil(img.height / sliceSize)
  const verticalSlices = Math.ceil(img.width / sliceSize)
  const slices = {}
  for (let i = 0; i < totalParts; i++) {
    const slice = {}
    const row = Math.floor(i / verticalSlices)
    const col = i - row * verticalSlices
    slice.x = col * sliceSize
    slice.y = row * sliceSize
    slice.width = (sliceSize - (slice.x + sliceSize <= img.width ? 0 : (slice.x + sliceSize) - img.width))
    slice.height = (sliceSize - (slice.y + sliceSize <= img.height ? 0 : (slice.y + sliceSize) - img.height))
    const key = `${slice.width}-${slice.height}`
    if (slices[key] == null) {
      slices[key] = []
    }
    slices[key].push(slice)
  }
  return slices
}

function getColsInGroup(slices) {
  if (slices.length == 1) {
    return 1
  }
  let t = 'init'
  for (let i = 0; i < slices.length; i++) {
    if (t == 'init') {
      t = slices[i].y
    }
    if (t != slices[i].y) {
      return i
    }
  }
  return slices.length
}

export default unscrambleImg