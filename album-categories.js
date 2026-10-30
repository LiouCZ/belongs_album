(() => {
  const rules = [
    ["胸针", /胸针|扣针|别针|pin$/i],
    ["耳钉", /耳钉/],
    ["耳环", /耳环/],
    ["Mini十字狗牌", /(?:mini|迷你)十字狗牌/i],
    ["M镂空十字", /m镂空十字|镂空m十字|镂空中十字/i],
    ["L十字", /l十字|十字架?l/i],
    ["M十字", /m十字|十字架?m/i],
    ["S十字", /s十字|十字架?s/i],
    ["大十字", /大十字/],
    ["中十字", /中十字/],
    ["小十字", /小十字/],
    ["初心羽戒指", /初心羽.*戒/],
    ["雏翼戒指", /雏翼.*戒/],
    ["羽翼戒指", /羽翼.*戒/],
    ["莫比乌斯戒指", /莫比.*戒/],
    ["平打戒指", /平打.*戒|开口平打戒/],
    ["符节戒指", /符节.*戒/],
    ["马蹄戒指", /马蹄.*戒/],
    ["B戒", /b(?:字母|字)?戒/i],
    ["K戒", /k戒/i],
    ["方戒", /方戒|方钻戒/],
    ["戒指", /戒指|指环|戒$/],
    ["平打宽手镯", /平打宽(?:手)?镯|宽平打手镯/],
    ["莫比乌斯手镯", /莫比.*镯/],
    ["初心羽手镯", /初心羽.*镯/],
    ["平打手镯", /平打.*镯/],
    ["手镯", /手镯|宽镯|银镯/],
    ["蛇骨手链", /蛇骨.*手链/],
    ["蛇骨项链", /蛇骨(?:项)?链/],
    ["手链", /手链/],
    ["角链", /角链/],
    ["丸链", /丸链/],
    ["银链", /银链/],
    ["项链", /项链|套链|ot链|蛇绳ot|链$/i],
    ["Mini金饼", /(?:mini|迷你)金饼/i],
    ["Mini银饼", /(?:mini|迷你)银饼/i],
    ["Mini金银饼", /(?:mini|迷你)金银饼/i],
    ["熔币饼", /熔币.*饼|熔古币银|熔币月饼/],
    ["古币饼", /古币饼|摩根饼/],
    ["银饼", /银饼|[sml]?饼(?:套装)?$/i],
    ["金饼", /金饼/],
    ["S羽翼", /s羽翼/i],
    ["贝贝羽", /贝贝?羽/],
    ["AB羽", /ab羽|abc羽/i],
    ["C羽", /c羽/i],
    ["初心羽", /初心羽|小羽/],
    ["羽翼", /羽翼|翼$/],
    ["狗牌", /狗牌/],
    ["浮雕绳牌", /浮雕(?:缰)?绳牌/],
    ["缰绳牌", /缰绳牌|绳牌/],
    ["合心牌", /合心牌|锁心吊坠/],
    ["方牌", /方牌/],
    ["茄形牌", /茄[形型].*牌/],
    ["银牌", /银牌/],
    ["金牌", /金牌/],
    ["鹰盾", /鹰盾|大蛇盾/],
    ["鹰首", /鹰首|鹰头/],
    ["马首", /马首|马头/],
    ["蛇首", /蛇首|蛇头/],
    ["口哨", /口哨/],
    ["十字", /十字|cross/i],
    ["吊坠", /吊坠|小坠|坠$/],
    ["包扣", /包扣/],
    ["莫比乌斯扣", /莫比.*扣/],
    ["八字扣", /八字扣|8字扣/],
    ["花扣", /花扣/],
    ["皮带扣", /皮带扣|皮扣/],
    ["扣饰", /主扣|扣子|马扣|马蹄扣|^扣$|银扣/],
    ["钥匙", /钥匙/],
    ["银勺", /银勺|蛇勺|勺叉|黄油刀/],
    ["如意夹", /如意夹/],
    ["钞票夹", /钞票夹|钱夹/],
    ["牌夹", /牌夹/],
    ["方巾扣", /方巾扣/],
    ["珠饰", /珠$/],
    ["打火机", /打火机|zippo/i],
    ["Bolo Tie", /bolotie|领结/i],
    ["印戳", /印戳/],
    ["配饰", /配饰|裤饰/],
  ];
  const metadata = /^(?:发售|购买|说明|备注|规格|材质|搭配|参考|重量|类型|正面|背面|主件|配件|作品说明|本期|图片|感谢|谢谢|由于)/;

  function numberedLabel(line) {
    return String(line || "").trim().replace(/^[*●•]\s*/, "")
      .match(/^(?:[①-⑳❶-❿⓫-⓴]|\d{1,2}\s*(?:->|[.．、)）-]))\s*(.+)$/u)?.[1] || null;
  }

  function categoryName(value) {
    const text = (numberedLabel(value) || String(value || "")).normalize("NFKC")
      .replace(/^[\s*●•]+/, "").replace(/\s+/g, "").trim();
    if (!text || text.length > 40 || metadata.test(text)) return null;
    const crossSize = text.match(/^十字架?\(([lms])\)/i);
    if (crossSize) return `${crossSize[1].toUpperCase()}十字`;
    const label = text.split(/[（(，,。；;：:]/)[0].replace(/#\d+$|[x×]\d+$/i, "");
    return rules.find(([, pattern]) => pattern.test(label))?.[0] || null;
  }

  function forGroup(group) {
    const title = String(group.title || "")
      .replace(/十字架?\s*[（(]\s*([lms])\s*[）)]/gi, "$1十字")
      .replace(/[（(][^）)]*[）)]/g, "");
    const titles = title.split(/[、,，/]/).map(categoryName).filter(Boolean);
    if (titles.length) return [...new Set(titles)];
    const lines = String(group.caption || "").split(/\r?\n/);
    const numbered = lines.map(numberedLabel).filter(Boolean).map(categoryName).filter(Boolean);
    if (numbered.length) return [...new Set(numbered)];
    // Old Word groups sometimes keep a sale heading above standalone work names.
    const standalone = lines.filter((line) => line.trim().length <= 20 && !/[。!?！？：:]/.test(line))
      .map(categoryName).filter(Boolean);
    return standalone.length ? [...new Set(standalone)] : ["其他图文"];
  }

  window.BELONGS_CATEGORIES = { forGroup };
})();
