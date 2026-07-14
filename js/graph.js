/* ==========================================================================
   NTE Transfer Guide — graph.js
   路線データからグラフを構築し、最短時間・最少乗換のルートを探索する。
   ========================================================================== */

const NTEGraph = (() => {

  function coordOf(pt) {
    return pt.type === 'station' ? POS[pt.id] : VERTICES[pt.id];
  }

  function dist(a, b) {
    return Math.hypot(a[0] - b[0], a[1] - b[1]);
  }

  // 各路線を「駅→駅」の区間（区間内の制御点列も保持）に分解する。
  function splitLineIntoSegments(line) {
    const pts = line.points;
    const segments = [];
    let bucket = [pts[0]];
    let startIdx = 0;
    for (let i = 1; i < pts.length; i++) {
      bucket.push(pts[i]);
      if (pts[i].type === 'station') {
        let d = 0;
        for (let j = 0; j < bucket.length - 1; j++) {
          d += dist(coordOf(bucket[j]), coordOf(bucket[j + 1]));
        }
        segments.push({
          from: pts[startIdx].id,
          to: pts[i].id,
          points: bucket.slice(),
          pixelDist: d,
          minutes: Math.max(1, Math.round(d / PX_PER_MINUTE)),
        });
        startIdx = i;
        bucket = [pts[i]];
      }
    }
    return segments;
  }

  // station -> [lineId,...] のインデックス
  function stationLineIndex() {
    const idx = {};
    for (const [lid, line] of Object.entries(CUSTOM_LINES)) {
      const seen = new Set();
      for (const p of line.points) {
        if (p.type === 'station' && !seen.has(p.id)) {
          seen.add(p.id);
          (idx[p.id] = idx[p.id] || new Set()).add(lid);
        }
      }
    }
    return idx;
  }

  /**
   * グラフのノードはすべて "station::line"（その路線に乗車中の状態）。
   *   ride:   station::line -> station::line (同一路線内、乗換なし)
   *   xfer:   station::lineA -> station::lineB (同一駅の構内乗換、所要時間あり)
   *   walk:   stationA::lineA -> stationB::lineB (改札外の連絡通路、所要時間あり)
   * 出発駅では「どの路線にもコスト0で乗車できる」ものとして探索時に種を撒き、
   * 到着駅では「どの路線からもコスト0で降車できる」ものとして到達判定する。
   * これにより、駅の途中で無料で路線を跨げてしまう抜け道を防ぎ、
   * 乗換（xfer/walk）に設定した所要時間が必ず計上されるようにしている。
   */
  function build() {
    const segmentsByLine = {};
    for (const [lid, line] of Object.entries(CUSTOM_LINES)) {
      segmentsByLine[lid] = splitLineIntoSegments(line);
    }

    const adj = {}; // node -> [{to, minutes, kind, lineId, meta}]
    function addEdge(from, to, minutes, kind, lineId, meta) {
      (adj[from] = adj[from] || []).push({ to, minutes, kind, lineId, meta });
    }

    const lineIdx = stationLineIndex();

    // ride edges (方向つき: loop 路線は一方向運転、それ以外は双方向)
    for (const [lid, line] of Object.entries(CUSTOM_LINES)) {
      const segs = segmentsByLine[lid];
      for (const seg of segs) {
        addEdge(`${seg.from}::${lid}`, `${seg.to}::${lid}`, seg.minutes, 'ride', lid, { seg });
        if (!line.loop) {
          addEdge(`${seg.to}::${lid}`, `${seg.from}::${lid}`, seg.minutes, 'ride', lid, { seg: reverseSeg(seg) });
        }
      }
    }

    // 同一駅・複数路線の構内乗換
    for (const [stationId, lineSet] of Object.entries(lineIdx)) {
      const lids = [...lineSet];
      if (lids.length < 2) continue;
      const t = STATION_TRANSFER_OVERRIDE[stationId] ?? STATION_TRANSFER_MIN_DEFAULT;
      for (const a of lids) {
        for (const b of lids) {
          if (a === b) continue;
          addEdge(`${stationId}::${a}`, `${stationId}::${b}`, t, 'xfer', b, { from: a, to: b, gate: 'inside' });
        }
      }
    }

    // 改札外の連絡通路（別駅間の徒歩乗換）
    for (const wt of WALK_TRANSFERS) {
      const aLines = [...(lineIdx[wt.a] || [])];
      const bLines = [...(lineIdx[wt.b] || [])];
      for (const la of aLines) {
        for (const lb of bLines) {
          addEdge(`${wt.a}::${la}`, `${wt.b}::${lb}`, wt.minutes, 'walk', lb, wt);
          addEdge(`${wt.b}::${lb}`, `${wt.a}::${la}`, wt.minutes, 'walk', la, wt);
        }
      }
    }

    return { adj, segmentsByLine, lineIdx };
  }

  function reverseSeg(seg) {
    return {
      from: seg.to,
      to: seg.from,
      points: seg.points.slice().reverse(),
      pixelDist: seg.pixelDist,
      minutes: seg.minutes,
    };
  }

  const GRAPH = build();

  function linesAtStation(stationId) {
    return [...(GRAPH.lineIdx[stationId] || [])];
  }

  // Dijkstra: cost = [time, transferCount] を辞書式に比較（fewestTransfers時は逆順で比較）
  // 出発駅ではその駅が持つ全路線に無料で「乗車」した状態を種として撒き、
  // 到着駅はどの路線の状態であっても到達とみなす（＝改札を出る動作は無料）。
  function dijkstra(startId, goalId, opts = {}) {
    const { preferFewTransfers = false } = opts;
    const dist_ = {};
    const prev = {};
    const visited = new Set();

    function better(a, b) {
      if (preferFewTransfers) {
        if (a.transfers !== b.transfers) return a.transfers < b.transfers;
        return a.time < b.time;
      }
      if (a.time !== b.time) return a.time < b.time;
      return a.transfers < b.transfers;
    }

    const startLines = linesAtStation(startId);
    if (startLines.length === 0) return null;

    const pq = [];
    for (const lid of startLines) {
      const node = `${startId}::${lid}`;
      dist_[node] = { time: 0, transfers: 0 };
      prev[node] = { seed: true };
      pq.push({ node, time: 0, transfers: 0 });
    }

    let goalNode = null;
    while (pq.length) {
      let bi = 0;
      for (let i = 1; i < pq.length; i++) {
        if (better(pq[i], pq[bi])) bi = i;
      }
      const cur = pq.splice(bi, 1)[0];
      if (visited.has(cur.node)) continue;
      visited.add(cur.node);
      if (cur.node.split('::')[0] === goalId) { goalNode = cur.node; break; }

      const edges = GRAPH.adj[cur.node] || [];
      for (const e of edges) {
        const isTransfer = e.kind === 'xfer' || e.kind === 'walk';
        const cand = {
          time: cur.time + e.minutes,
          transfers: cur.transfers + (isTransfer ? 1 : 0),
        };
        const existing = dist_[e.to];
        if (!existing || better(cand, existing)) {
          dist_[e.to] = cand;
          prev[e.to] = { node: cur.node, edge: e };
          pq.push({ node: e.to, ...cand });
        }
      }
    }

    if (!goalNode) return null;

    // build path back to a seed node
    const nodes = [];
    const edges = [];
    let node = goalNode;
    while (!prev[node].seed) {
      const p = prev[node];
      nodes.unshift(node);
      edges.unshift(p.edge);
      node = p.node;
    }
    nodes.unshift(node); // the seed ("start::line") node itself

    return {
      totalMinutes: dist_[goalNode].time,
      transferCount: dist_[goalNode].transfers,
      startId, goalId,
      nodes,
      edges,
    };
  }

  // ルートを「乗車→乗換→乗車…」の legs 形式に整形
  function toLegs(route) {
    if (!route) return null;
    const legs = [];
    let cur = { lineId: route.nodes[0].split('::')[1], from: route.nodes[0].split('::')[0], to: null, segs: [], minutes: 0 };

    for (let i = 0; i < route.edges.length; i++) {
      const e = route.edges[i];
      if (e.kind === 'ride') {
        cur.to = e.to.split('::')[0];
        cur.segs.push(e.meta.seg);
        cur.minutes += e.minutes;
      } else if (e.kind === 'xfer' || e.kind === 'walk') {
        if (cur.to) legs.push(cur); // 直前の乗車区間を確定
        legs.push({ transfer: true, kind: e.kind, gate: e.meta.gate,
          stationFrom: route.nodes[i].split('::')[0], stationTo: route.nodes[i + 1].split('::')[0],
          minutes: e.minutes, label: e.meta.label });
        cur = { lineId: e.lineId, from: e.to.split('::')[0], to: null, segs: [], minutes: 0 };
      }
    }
    if (cur.to) legs.push(cur);
    return legs;
  }

  // 経由駅を指定したルート探索（区間ごとに最短時間を連結）
  function findRoute(fromId, toId, viaIds = [], opts = {}) {
    const chain = [fromId, ...viaIds, toId];
    let totalMinutes = 0;
    let totalTransfers = 0;
    const allLegs = [];
    for (let i = 0; i < chain.length - 1; i++) {
      const r = dijkstra(chain[i], chain[i + 1], opts);
      if (!r) return null;
      totalMinutes += r.totalMinutes;
      totalTransfers += r.transferCount;
      const legs = toLegs(r);
      // 経由地点をまたぐ場合、同一路線同一方向であれば legs を結合する
      if (allLegs.length && legs.length) {
        const lastLeg = allLegs[allLegs.length - 1];
        const firstLeg = legs[0];
        if (!lastLeg.transfer && !firstLeg.transfer && lastLeg.lineId === firstLeg.lineId && lastLeg.to === firstLeg.from) {
          lastLeg.to = firstLeg.to;
          lastLeg.segs.push(...firstLeg.segs);
          lastLeg.minutes += firstLeg.minutes;
          legs.shift();
        }
      }
      allLegs.push(...legs);
    }
    return { totalMinutes, transferCount: totalTransfers, legs: allLegs };
  }

  function stationName(id) {
    return (STATIONS[id] && STATIONS[id].name) || id;
  }

  return { GRAPH, dijkstra, toLegs, findRoute, stationName, splitLineIntoSegments };
})();
