/* ==========================================================================
   NTE Transfer Guide — data.js
   ヘテロシティ鉄道（城際急行）路線データ
   駅・制御点の座標は Neverness_Map.png (5632×5632px) 上のピクセル座標。
   出典: プレイヤー提供の実測データ / note「【NTE】公共交通に乗ろう！#1 鉄道編」
   ========================================================================== */

// ---- 駅座標 -----------------------------------------------------------
const POS = {
  s1: [1973, 3789],  // クリアビュー丘駅
  s2: [1897, 2681],  // 絵空町駅
  s3: [2499, 3078],  // ハンカク街駅
  s4: [2145, 3019],  // ミズキ駅
  s5: [3072, 2490],  // カミラ駅
  s6: [2753, 2833],  // タリン駅
  s7: [3524, 2402],  // フウノ駅
  s8: [3092, 2224],  // 南レイヤー駅
  s9: [3093, 2179],  // 北イヤー駅
  s10: [2685, 2199], // チェシャ駅
  s11: [2840, 1916], // ロンバス湖駅
  s13: [2493, 1594], // ユラメキ駅
  s14: [2776, 1559], // 北角駅
};

// ---- 路線の曲線を決める制御点（駅ではない）-----------------------------
const VERTICES = {
  v1: [1705, 2773], v2: [1673, 2833], v3: [1687, 2872], v4: [1712, 2926], v5: [1746, 3008],
  v6: [1773, 3102], v7: [1836, 3468], v8: [1792, 3619], v9: [1780, 3722], v10: [1793, 3779],
  v11: [1820, 3802], v12: [1871, 3820], v13: [1924, 3812], v14: [2030, 3762], v15: [2095, 3721],
  v16: [2155, 3632], v17: [2187, 3521], v18: [2213, 3440], v19: [2244, 3363], v20: [2283, 3317],
  v21: [2361, 3240], v22: [2429, 3178], v23: [2488, 3121], v24: [2502, 3009], v25: [2495, 2966],
  v26: [2496, 2920], v27: [2497, 2845], v28: [2499, 2752], v29: [2505, 2653], v30: [2502, 2634],
  v31: [2489, 2611], v32: [2466, 2593], v33: [2445, 2586], v34: [2392, 2572], v35: [2283, 2556],
  v36: [2209, 2546], v37: [2152, 2561], v38: [2261, 2924], v39: [2423, 2828], v40: [2490, 2812],
  v41: [2587, 2781], v42: [2683, 2732], v43: [3002, 2574], v44: [2802, 3024], v45: [2834, 3065],
  v46: [2883, 3076], v47: [2979, 3054], v48: [3324, 2966], v49: [3480, 2932], v50: [3565, 2880],
  v51: [3591, 2854], v52: [3633, 2800], v53: [3667, 2750], v54: [3657, 2703], v55: [3603, 2578],
  v56: [3554, 2472], v57: [3481, 2296], v58: [3456, 2252], v59: [3418, 2221], v60: [3380, 2210],
  v61: [3325, 2209], v62: [3137, 2222], v63: [2903, 2241], v64: [2835, 2257], v65: [2786, 2284],
  v66: [2739, 2313], v67: [2709, 2338], v68: [2692, 2380], v69: [2686, 2410], v70: [2683, 2514],
  v71: [2690, 2595], v72: [2709, 2672], v73: [2561, 2211], v74: [2480, 2220], v75: [2411, 2224],
  v76: [2372, 2216], v77: [2350, 2194], v78: [2341, 2170], v79: [2323, 2109], v80: [2329, 2080],
  v81: [2345, 2053], v82: [2375, 2019], v83: [2403, 1997], v84: [2430, 1984], v85: [2465, 1969],
  v86: [2491, 1960], v87: [2523, 1950], v88: [2560, 1938], v89: [2598, 1927], v90: [2637, 1920],
  v91: [2674, 1920], v92: [2708, 1918], v93: [2750, 1918], v94: [2794, 1917], v95: [2893, 1918],
  v96: [2929, 1918], v97: [2967, 1916], v98: [3013, 1913], v99: [3073, 1906], v100: [3128, 1900],
  v101: [3190, 1892], v102: [3269, 1880], v103: [3347, 1879], v104: [3489, 1882], v105: [3532, 1903],
  v106: [3547, 1936], v107: [3548, 1968], v108: [3533, 2026], v109: [3509, 2100], v110: [3481, 2160],
  v111: [3454, 2173], v112: [3347, 2172], v113: [3286, 2172], v114: [3213, 2176], v115: [3177, 2172],
  v116: [2774, 1910], v117: [2682, 1911], v118: [2617, 1916], v119: [2537, 1935], v120: [2476, 1957],
  v121: [2434, 1970], v122: [2397, 1969], v123: [2364, 1938], v124: [2332, 1880], v125: [2343, 1812],
  v126: [2365, 1773], v127: [2381, 1731], v128: [2401, 1685], v129: [2429, 1646], v130: [2591, 1555],
  v131: [2658, 1540], v132: [2725, 1546], v133: [2828, 1568], v134: [2873, 1564], v135: [2903, 1560],
  v136: [2940, 1576], v137: [2974, 1607], v138: [3055, 1658], v139: [3127, 1685], v140: [3204, 1708],
  v141: [3243, 1721], v142: [3269, 1745], v143: [3295, 1782], v144: [3299, 1816], v145: [3292, 1840],
  v146: [3273, 1864], v147: [3246, 1874], v148: [3207, 1883], v149: [3159, 1889], v150: [3107, 1896],
  v151: [3055, 1900], v152: [3001, 1908], v153: [2947, 1912], v154: [2913, 1912], v155: [2875, 1912],
};

// ---- 路線データ ---------------------------------------------------------
// points: 駅(station)と制御点(vertex)を通過順に列挙。滑らかな曲線描画に使用。
const CUSTOM_LINES = {
  l1: { name: '環海線', symbol: 'H', hex: '#7CB342', loop: true, smooth: true,
    points: [{type:'station',id:'s2'},{type:'vertex',id:'v1'},{type:'vertex',id:'v2'},{type:'vertex',id:'v3'},{type:'vertex',id:'v4'},{type:'vertex',id:'v5'},{type:'vertex',id:'v6'},{type:'vertex',id:'v7'},{type:'vertex',id:'v8'},{type:'vertex',id:'v9'},{type:'vertex',id:'v10'},{type:'vertex',id:'v11'},{type:'vertex',id:'v12'},{type:'vertex',id:'v13'},{type:'station',id:'s1'},{type:'vertex',id:'v14'},{type:'vertex',id:'v15'},{type:'vertex',id:'v16'},{type:'vertex',id:'v17'},{type:'vertex',id:'v18'},{type:'vertex',id:'v19'},{type:'vertex',id:'v20'},{type:'vertex',id:'v21'},{type:'vertex',id:'v22'},{type:'vertex',id:'v23'},{type:'station',id:'s3'},{type:'vertex',id:'v24'},{type:'vertex',id:'v25'},{type:'vertex',id:'v26'},{type:'vertex',id:'v27'},{type:'vertex',id:'v28'},{type:'vertex',id:'v29'},{type:'vertex',id:'v30'},{type:'vertex',id:'v31'},{type:'vertex',id:'v32'},{type:'vertex',id:'v33'},{type:'vertex',id:'v34'},{type:'vertex',id:'v35'},{type:'vertex',id:'v36'},{type:'vertex',id:'v37'},{type:'station',id:'s2'}] },
  l2: { name: '橋新線', symbol: 'B', hex: '#E8615F', loop: false, smooth: true,
    points: [{type:'station',id:'s4'},{type:'vertex',id:'v38'},{type:'vertex',id:'v39'},{type:'vertex',id:'v40'},{type:'vertex',id:'v41'},{type:'vertex',id:'v42'},{type:'vertex',id:'v43'},{type:'station',id:'s5'}] },
  l3: { name: '環新線', symbol: 'N', hex: '#fac823', loop: true, smooth: true,
    points: [{type:'station',id:'s6'},{type:'vertex',id:'v44'},{type:'vertex',id:'v45'},{type:'vertex',id:'v46'},{type:'vertex',id:'v47'},{type:'vertex',id:'v48'},{type:'vertex',id:'v49'},{type:'vertex',id:'v50'},{type:'vertex',id:'v51'},{type:'vertex',id:'v52'},{type:'vertex',id:'v53'},{type:'vertex',id:'v54'},{type:'vertex',id:'v55'},{type:'vertex',id:'v56'},{type:'station',id:'s7'},{type:'vertex',id:'v57'},{type:'vertex',id:'v58'},{type:'vertex',id:'v59'},{type:'vertex',id:'v60'},{type:'vertex',id:'v61'},{type:'vertex',id:'v62'},{type:'station',id:'s8'},{type:'vertex',id:'v63'},{type:'vertex',id:'v64'},{type:'vertex',id:'v65'},{type:'vertex',id:'v66'},{type:'vertex',id:'v67'},{type:'vertex',id:'v68'},{type:'vertex',id:'v69'},{type:'vertex',id:'v70'},{type:'vertex',id:'v71'},{type:'vertex',id:'v72'},{type:'station',id:'s6'}] },
  l4: { name: '上晴線', symbol: 'S', hex: '#e6e664', loop: true, smooth: true,
    points: [{type:'station',id:'s9'},{type:'station',id:'s10'},{type:'vertex',id:'v73'},{type:'vertex',id:'v74'},{type:'vertex',id:'v75'},{type:'vertex',id:'v76'},{type:'vertex',id:'v77'},{type:'vertex',id:'v78'},{type:'vertex',id:'v79'},{type:'vertex',id:'v80'},{type:'vertex',id:'v81'},{type:'vertex',id:'v82'},{type:'vertex',id:'v83'},{type:'vertex',id:'v84'},{type:'vertex',id:'v85'},{type:'vertex',id:'v86'},{type:'vertex',id:'v87'},{type:'vertex',id:'v88'},{type:'vertex',id:'v89'},{type:'vertex',id:'v90'},{type:'vertex',id:'v91'},{type:'vertex',id:'v92'},{type:'vertex',id:'v93'},{type:'vertex',id:'v94'},{type:'station',id:'s11'},{type:'vertex',id:'v95'},{type:'vertex',id:'v96'},{type:'vertex',id:'v97'},{type:'vertex',id:'v98'},{type:'vertex',id:'v99'},{type:'vertex',id:'v100'},{type:'vertex',id:'v101'},{type:'vertex',id:'v102'},{type:'vertex',id:'v103'},{type:'vertex',id:'v104'},{type:'vertex',id:'v105'},{type:'vertex',id:'v106'},{type:'vertex',id:'v107'},{type:'vertex',id:'v108'},{type:'vertex',id:'v109'},{type:'vertex',id:'v110'},{type:'vertex',id:'v111'},{type:'vertex',id:'v112'},{type:'vertex',id:'v113'},{type:'vertex',id:'v114'},{type:'vertex',id:'v115'},{type:'station',id:'s9'}] },
  l5: { name: '水菱線', symbol: 'C', hex: '#dcc8c8', loop: true, smooth: true,
    points: [{type:'station',id:'s11'},{type:'vertex',id:'v116'},{type:'vertex',id:'v117'},{type:'vertex',id:'v118'},{type:'vertex',id:'v119'},{type:'vertex',id:'v120'},{type:'vertex',id:'v121'},{type:'vertex',id:'v122'},{type:'vertex',id:'v123'},{type:'vertex',id:'v124'},{type:'vertex',id:'v125'},{type:'vertex',id:'v126'},{type:'vertex',id:'v127'},{type:'vertex',id:'v128'},{type:'vertex',id:'v129'},{type:'station',id:'s13'},{type:'vertex',id:'v130'},{type:'vertex',id:'v131'},{type:'vertex',id:'v132'},{type:'station',id:'s14'},{type:'vertex',id:'v133'},{type:'vertex',id:'v134'},{type:'vertex',id:'v135'},{type:'vertex',id:'v136'},{type:'vertex',id:'v137'},{type:'vertex',id:'v138'},{type:'vertex',id:'v139'},{type:'vertex',id:'v140'},{type:'vertex',id:'v141'},{type:'vertex',id:'v142'},{type:'vertex',id:'v143'},{type:'vertex',id:'v144'},{type:'vertex',id:'v145'},{type:'vertex',id:'v146'},{type:'vertex',id:'v147'},{type:'vertex',id:'v148'},{type:'vertex',id:'v149'},{type:'vertex',id:'v150'},{type:'vertex',id:'v151'},{type:'vertex',id:'v152'},{type:'vertex',id:'v153'},{type:'vertex',id:'v154'},{type:'vertex',id:'v155'},{type:'station',id:'s11'}] },
};

// ---- 駅名マスタ（POS のコメントから生成）------------------------------
const STATIONS = {
  s1:  { name: 'クリアビュー丘駅' },
  s2:  { name: '絵空町駅' },
  s3:  { name: 'ハンカク街駅' },
  s4:  { name: 'ミズキ駅' },
  s5:  { name: 'カミラ駅' },
  s6:  { name: 'タリン駅' },
  s7:  { name: 'フウノ駅' },
  s8:  { name: '南レイヤー駅' },
  s9:  { name: '北イヤー駅' },
  s10: { name: 'チェシャ駅' },
  s11: { name: 'ロンバス湖駅' },
  s13: { name: 'ユラメキ駅' },
  s14: { name: '北角駅' },
};

// ---- 徒歩・構内乗り換え定義 --------------------------------------------
// 通常の乗り換えは同一駅（同じ station id）で自動的に扱われる。
// ここには「別々の駅だが乗り換え通路で繋がっている」特殊なケースのみを書く。
const WALK_TRANSFERS = [
  {
    a: 's8', b: 's9',
    minutes: 6,
    gate: 'outside', // 改札外乗り換え
    label: '乗り換え通路',
    note: '南レイヤー駅と北イヤー駅は隣接する別駅で、連絡通路を使った改札外乗り換えとなります。',
  },
  {
    a: 's3', b: 's4',
    minutes: 5,
    gate: 'outside',
    label: '徒歩移動',
    note: 'ハンカク街駅とミズキ駅は近接する別駅で、徒歩での乗り換えとなります。',
  },
  {
    a: 's5', b: 's9',
    minutes: 4,
    gate: 'outside',
    label: '徒歩移動',
    note: 'カミラ駅と北イヤー駅は近接する別駅で、徒歩での乗り換えとなります。',
  },
];

// 同一駅で複数路線が発着する場合の構内乗り換え所要時間（分）。
// 該当なしの場合は既定値 STATION_TRANSFER_MIN が使われる。
const STATION_TRANSFER_OVERRIDE = {
  s11: 2, // ロンバス湖駅: 上晴線・水菱線は並走区間があり、跨線橋での構内（改札内）乗り換え
};

const STATION_TRANSFER_MIN_DEFAULT = 3;

// 走行速度換算（px→分）。実測データが無いため、駅間の描画距離から
// おおよその所要時間を概算するための経験的な係数。
const PX_PER_MINUTE = 450;
