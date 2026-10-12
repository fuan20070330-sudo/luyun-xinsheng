(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.LuyunMemoryGraph = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var CRAFT_TERMS = ['选枣','选料','蒸制','炒馅','包制','烘烤','熬制','发酵','晾晒','炒制','成型','包装','和面','烘焙','手作'];
  function clean(value) { return String(value == null ? '' : value).replace(/^品牌档案（模拟）第\d+条：/, '').replace(/^受访记录（模拟）第\d+条：/, '').trim(); }
  function unique(values) { return Array.from(new Set(values.filter(Boolean))); }
  function addNode(nodes, seen, node) { if (!node || !node.id || seen[node.id]) return; seen[node.id] = true; nodes.push(node); }
  function addEdge(edges, seen, source, target, relation) { var id = source + '|' + relation + '|' + target; if (seen[id]) return; seen[id] = true; edges.push({ id: id, source: source, target: target, relation: relation }); }
  function extractCraftTerms(text) { return CRAFT_TERMS.filter(function (term) { return String(text || '').indexOf(term) !== -1; }); }
  function splitProducts(text) { var cleanText = clean(text).replace(/^.*?产品包括/, '').replace(/[。；;]$/g, ''); return unique(cleanText.split(/[、,，和及以及]/).map(function (item) { return item.replace(/等.*$/, '').trim(); }).filter(function (item) { return item.length >= 2 && item.length <= 18; })).slice(0, 8); }
  function build(brand, facts, documents) {
    brand = brand || {}; facts = facts || []; documents = documents || [];
    var nodes = []; var edges = []; var nodeSeen = {}; var edgeSeen = {};
    var brandId = 'brand:' + (brand.id || brand.name || 'current');
    addNode(nodes, nodeSeen, { id: brandId, type: 'brand', label: brand.name || '当前品牌', detail: brand.type || '品牌', factIds: [], evidence: '品牌基本信息' });
    facts.forEach(function (fact) {
      if (!fact || !fact.text || fact.category === '品牌理念' && /暂未/.test(fact.text)) return;
      var source = 'fact:' + fact.id;
      var sourceDetail = fact.sourceAuthority || '来源待评估';
      addNode(nodes, nodeSeen, { id: source, type: 'evidence', label: fact.id, detail: fact.status + '｜' + sourceDetail, factIds: [fact.id], evidence: fact.source || '未找到来源', hash: fact.sourceHash || '', level: fact.evidenceLevel || '' });
      addEdge(edges, edgeSeen, brandId, source, '拥有事实');
      if (fact.category === '历史') {
        var years = String(fact.text).match(/\b(?:18|19|20)\d{2}\b/g) || [];
        years.forEach(function (year) { var id = 'time:' + year; addNode(nodes, nodeSeen, { id: id, type: 'time', label: year + '年', detail: clean(fact.text).slice(0, 50), factIds: [fact.id], evidence: sourceDetail }); addEdge(edges, edgeSeen, brandId, id, '时间起点'); addEdge(edges, edgeSeen, id, source, '由事实支持'); });
      }
      if (fact.category === '工艺') {
        var terms = extractCraftTerms(fact.text);
        if (!terms.length) terms = [clean(fact.text).slice(0, 14)];
        terms.forEach(function (term) { var id = 'craft:' + term; addNode(nodes, nodeSeen, { id: id, type: 'craft', label: term, detail: clean(fact.text).slice(0, 60), factIds: [fact.id], evidence: sourceDetail }); addEdge(edges, edgeSeen, brandId, id, '包含工序'); addEdge(edges, edgeSeen, id, source, '由事实支持'); });
      }
      if (fact.category === '产品') {
        splitProducts(fact.text).forEach(function (product) { var id = 'product:' + product; addNode(nodes, nodeSeen, { id: id, type: 'product', label: product, detail: clean(fact.text).slice(0, 60), factIds: [fact.id], evidence: sourceDetail }); addEdge(edges, edgeSeen, brandId, id, '提供产品'); addEdge(edges, edgeSeen, id, source, '由事实支持'); });
      }
      if (fact.category === '荣誉') {
        var honorTerms = ['山东老字号','中华老字号','国家级非遗','非遗','驰名商标'].filter(function (term) { return fact.text.indexOf(term) !== -1; });
        (honorTerms.length ? honorTerms : [clean(fact.text).slice(0, 14)]).forEach(function (honor) { var id = 'honor:' + honor; addNode(nodes, nodeSeen, { id: id, type: 'honor', label: honor, detail: clean(fact.text).slice(0, 60), factIds: [fact.id], evidence: sourceDetail }); addEdge(edges, edgeSeen, brandId, id, '登记荣誉'); addEdge(edges, edgeSeen, id, source, '由事实支持'); });
      }
      if (fact.category === '人物' || fact.category === '访谈洞察') {
        var match = clean(fact.text).match(/([\u4e00-\u9fa5]{2,5})(?:表示|说|回忆|讲述|认为)/);
        var person = match ? match[1] : (fact.category === '人物' ? clean(fact.text).slice(0, 10) : '传承人');
        var personId = 'person:' + person;
        addNode(nodes, nodeSeen, { id: personId, type: 'person', label: person, detail: clean(fact.text).slice(0, 70), factIds: [fact.id], evidence: sourceDetail });
        addEdge(edges, edgeSeen, brandId, personId, '人物关联'); addEdge(edges, edgeSeen, personId, source, '口述来源');
      }
      if (fact.category === '品牌理念') {
        var ideaId = 'idea:' + fact.id; addNode(nodes, nodeSeen, { id: ideaId, type: 'idea', label: clean(fact.text).slice(0, 16), detail: clean(fact.text).slice(0, 70), factIds: [fact.id], evidence: sourceDetail }); addEdge(edges, edgeSeen, brandId, ideaId, '品牌理念');
      }
    });
    return { brandId: brandId, nodes: nodes, edges: edges, documents: documents.map(function (item) { return { id: item.id, name: item.name, hash: item.hash, authority: item.authority }; }), stats: { nodes: nodes.length, edges: edges.length, facts: facts.length, sources: documents.filter(function (item) { return item.hash; }).length } };
  }
  return { build: build, CRAFT_TERMS: CRAFT_TERMS, extractCraftTerms: extractCraftTerms, splitProducts: splitProducts };
}));