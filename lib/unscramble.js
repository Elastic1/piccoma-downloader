//@ts-check
const shuffleSeed = require('shuffle-seed')
const PureImage = require('pureimage')
// copied from piccoma
module.exports = function unscramble(pdata, image, num, seed) {
  var global_n, global_r, global_e;
  3 !== parseInt(pdata.category) || "P" !== pdata.scroll && "R" !== pdata.scroll ? (global_n = 0,
    global_r = 0,
    global_e = .01) : (global_n = 30,
      global_r = 30,
      global_e = 0);

  var c = Math.ceil(image.width / num) * Math.ceil(image.height / num)
    , f = [];
  for (y = 0; y < c; y++)
    f.push(y);
  var a = PureImage.make(image.width, image.height)
    , s = a.getContext("2d");
  a.width = image.width,
    a.height = image.height + global_n + global_r
  if (!pdata.isScrambled) {
    s.drawImage(image, 0, 0, image.width, image.height, 0, 0, image.width, image.height);
    return a;
  }
  var l = Math.ceil(image.width / num)
    , h = (image.height,
      function (t) {
        var n = {};
        return n.slices = t.length,
          n.cols = function (t) {
            if (1 == t.length)
              return 1;
            for (var n = "init", r = 0; r < t.length; r++)
              if ("init" == n && (n = t[r].y),
                n != t[r].y)
                return r;
            return r
          }(t),
          n.rows = t.length / n.cols,
          n.width = t[0].width * n.cols,
          n.height = t[0].height * n.rows,
          n.x = t[0].x,
          n.y = t[0].y,
          n
      }
    )
    , p = function () {
      var n, r = {};
      for (n = 0; n < c; n++) {
        var e = {}
          , i = Math.floor(n / l)
          , u = n - i * l;
        e.x = u * num,
          e.y = i * num,
          e.width = num - (e.x + num <= image.width ? 0 : e.x + num - image.width),
          e.height = num - (e.y + num <= image.height ? 0 : e.y + num - image.height),
          r[e.width + "-" + e.height] || (r[e.width + "-" + e.height] = []),
          r[e.width + "-" + e.height].push(e)
      }
      return r
    }();
  for (var v in p) {
    var y, d = h(p[v]), g = [];
    for (y = 0; y < p[v].length; y++)
      g.push(y);
    for (g = shuffleSeed.shuffle(g, seed),
      y = 0; y < p[v].length; y++) {
      var b = g[y]
        , m = Math.floor(b / d.cols)
        , x = (b - m * d.cols) * p[v][y].width
        , S = m * p[v][y].height;
      s.drawImage(image, d.x + x, d.y + S, p[v][y].width, p[v][y].height + global_e, p[v][y].x, p[v][y].y + global_n, p[v][y].width, p[v][y].height)
    }
  }
  return a
}