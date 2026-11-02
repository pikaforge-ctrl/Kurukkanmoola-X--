// Atlas stand-ins so geometry/placement code can run without a canvas (tests and debugging).
const rect = [0, 0, 1, 1];
const proxy = (v = rect) => new Proxy({}, {get: () => v});
export const stubAssets = () => ({
  facade: {rects: proxy()}, signs: {rects: proxy(), ids: ['hotel', 'restaurant', 'tea1', 'stores']}, roadSigns: {rects: proxy({rect, aspect: .6})},
  posters: {list: [{key: 'p0', kind: 'movie', aspect: 1.5, worn: false}, {key: 's1', kind: 'strip', aspect: .33, worn: true}], rects: {p0: rect, s1: rect}, billList: ['b0'], billboards: {b0: rect}},
  veg: {rects: proxy()},
});
