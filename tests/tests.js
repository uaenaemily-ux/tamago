// 浏览器里运行的简单测试。打开 /tests/ 即可看到结果。
import { el } from "../js/ui/dom.js";
import { createStore, clear } from "../js/vendor/idb-keyval.js";
import * as dates from "../js/dates.js";
import { migrate, createDefaultData, CURRENT_VERSION } from "../js/schema.js";
import * as store from "../js/store.js";
import { isPhotoDataUrl } from "../js/photos.js";

const TEST_DB = "tamago-test";
const groups = [];
let current = null;

function group(name, fn) {
  current = { name, tests: [] };
  groups.push(current);
  fn();
}
function test(name, fn) {
  current.tests.push({ name, fn });
}

function equal(actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`期望 ${e}，实际 ${a}`);
}
async function throws(fn, includes) {
  try {
    await fn();
  } catch (err) {
    if (includes && !err.message.includes(includes)) {
      throw new Error(`报错内容应包含「${includes}」，实际是「${err.message}」`);
    }
    return;
  }
  throw new Error("应该报错，但没有报错");
}

const day = (y, m, d) => new Date(y, m - 1, d); // 本地日期
const TODAY = day(2026, 10, 11);

// ---------------- 日期 ----------------
group("日期计算（dates.js）", () => {
  test("闰年判断", () => {
    equal([2024, 2025, 1900, 2000].map(dates.isLeapYear), [true, false, false, true]);
  });

  test("今天过生日 → 还有 0 天", () => {
    equal(dates.nextBirthday({ year: 2000, month: 10, day: 11 }, TODAY).daysUntil, 0);
  });

  test("明天过生日 → 还有 1 天，满 26 岁", () => {
    const r = dates.nextBirthday({ year: 2000, month: 10, day: 12 }, TODAY);
    equal([r.daysUntil, r.turningAge], [1, 26]);
  });

  test("昨天刚过 → 等明年，还有 364 天", () => {
    const r = dates.nextBirthday({ year: null, month: 10, day: 10 }, TODAY);
    equal([r.daysUntil, r.date, r.turningAge], [364, { year: 2027, month: 10, day: 10 }, null]);
  });

  test("跨年：12 月 31 日看 1 月 1 日 → 还有 1 天", () => {
    equal(dates.nextBirthday({ year: null, month: 1, day: 1 }, day(2026, 12, 31)).daysUntil, 1);
  });

  test("2 月 29 日出生，非闰年按 2 月 28 日提醒", () => {
    const r = dates.nextBirthday({ year: 2000, month: 2, day: 29 }, day(2027, 2, 1));
    equal([r.date, r.daysUntil], [{ year: 2027, month: 2, day: 28 }, 27]);
  });

  test("2 月 29 日出生，闰年按 2 月 29 日提醒", () => {
    const r = dates.nextBirthday({ year: 2000, month: 2, day: 29 }, day(2028, 2, 1));
    equal([r.date, r.daysUntil], [{ year: 2028, month: 2, day: 29 }, 28]);
  });

  test("跨夏令时也按整天计算", () => {
    equal(dates.diffDays({ year: 2026, month: 3, day: 1 }, { year: 2026, month: 4, day: 1 }), 31);
  });

  test("年龄：生日前一天 / 当天", () => {
    const b = { year: 2000, month: 10, day: 12 };
    equal([dates.getAge(b, TODAY), dates.getAge(b, day(2026, 10, 12))], [25, 26]);
  });

  test("年龄：不知道出生年份 → 不显示", () => {
    equal(dates.getAge({ year: null, month: 5, day: 1 }, TODAY), null);
  });

  test("年龄：2 月 29 日出生，非闰年 2 月 28 日长一岁", () => {
    const b = { year: 2000, month: 2, day: 29 };
    equal([dates.getAge(b, day(2027, 2, 27)), dates.getAge(b, day(2027, 2, 28))], [26, 27]);
  });

  test("星座分界", () => {
    const cases = [[1, 19], [1, 20], [2, 29], [3, 21], [8, 23], [12, 21], [12, 22]];
    equal(cases.map(([month, d]) => dates.getZodiac({ month, day: d })),
      ["摩羯座", "水瓶座", "双鱼座", "白羊座", "处女座", "射手座", "摩羯座"]);
  });

  test("生日检查：不知道年份时允许 2 月 29 日", () => {
    equal(dates.validateBirthday({ year: null, month: 2, day: 29 }, TODAY), null);
  });

  test("生日检查：非闰年没有 2 月 29 日、月份超出、未来日期、年份太早", () => {
    equal([
      dates.validateBirthday({ year: 2025, month: 2, day: 29 }, TODAY),
      dates.validateBirthday({ year: null, month: 13, day: 1 }, TODAY),
      dates.validateBirthday({ year: 2026, month: 10, day: 12 }, TODAY),
      dates.validateBirthday({ year: 1899, month: 1, day: 1 }, TODAY),
    ], ["这个月没有这一天", "请选择月份", "生日不能晚于今天", "出生年份不太对"]);
  });

  test("显示格式", () => {
    equal([
      dates.formatBirthday({ year: 2000, month: 3, day: 14 }),
      dates.formatBirthday({ year: null, month: 3, day: 14 }),
    ], ["2000年3月14日", "3月14日"]);
  });

  test("按下一次生日排序", () => {
    const people = [
      { name: "C", birthday: { year: null, month: 10, day: 10 } }, // 364 天
      { name: "A", birthday: { year: null, month: 10, day: 20 } }, // 9 天
      { name: "B", birthday: { year: null, month: 10, day: 11 } }, // 0 天
    ];
    equal(dates.sortByNextBirthday(people, TODAY).map((r) => r.person.name), ["B", "A", "C"]);
  });
});

group("首页生日（dates.js）", () => {
  const P = (name, month, d) => ({ name, birthday: { year: null, month, day: d } });
  const OPTS = { heroDays: 3, rangeDays: 30 };
  const names = (list) => list.map((e) => e.person.name);

  test("3 天内（含当天）的人都进大蛋区，按日期从近到远", () => {
    // 今天 10/11：今天、3 天后、4 天后、20 天后
    const r = dates.upcomingBirthdays([P("4天", 10, 15), P("今天", 10, 11), P("20天", 10, 31), P("3天", 10, 14)], OPTS, TODAY);
    equal([names(r.featured), names(r.others), r.next], [["今天", "3天"], ["4天", "20天"], null]);
  });

  test("多人同一天也都在大蛋区", () => {
    const r = dates.upcomingBirthdays([P("A", 10, 12), P("B", 10, 12), P("C", 10, 20)], OPTS, TODAY);
    equal([r.featured.length, r.others.length], [2, 1]);
  });

  test("3 天内没人 → 大蛋区放最近那一天的人，小蛋区不重复", () => {
    const r = dates.upcomingBirthdays([P("10天", 10, 21), P("10天b", 10, 21), P("20天", 10, 31)], OPTS, TODAY);
    equal([names(r.featured), names(r.others)], [["10天", "10天b"], ["20天"]]);
  });

  test("天数可以调整（heroDays = 0 时只放当天）", () => {
    const r = dates.upcomingBirthdays([P("今天", 10, 11), P("明天", 10, 12)], { heroDays: 0, rangeDays: 30 }, TODAY);
    equal([names(r.featured), names(r.others)], [["今天"], ["明天"]]);
  });

  test("30 天内没人 → 给出下一个最近的生日", () => {
    const r = dates.upcomingBirthdays([P("远", 12, 1), P("更远", 1, 5)], OPTS, TODAY);
    equal([r.featured.length, r.next.person.name, r.next.daysUntil], [0, "远", 51]);
  });

  test("第 30 天也算在区间内", () => {
    const r = dates.upcomingBirthdays([P("刚好", 11, 10)], OPTS, TODAY);
    equal(r.featured.map((e) => e.daysUntil), [30]);
  });

  test("一个人都没有", () => {
    equal(dates.upcomingBirthdays([], OPTS, TODAY), { featured: [], others: [], next: null });
  });

  test("英文序数词", () => {
    equal([1, 2, 3, 4, 11, 12, 13, 21, 22, 26, 101, 111].map(dates.ordinal),
      ["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "26th", "101st", "111th"]);
  });
});

// ---------------- 数据格式 ----------------
group("数据格式与版本（schema.js）", () => {
  test("当前版本的数据原样通过", () => {
    const data = createDefaultData();
    equal(migrate(data), data);
  });

  test("不改动传入的原数据", () => {
    const data = { schemaVersion: CURRENT_VERSION, people: [] };
    migrate(data);
    equal(Object.keys(data), ["schemaVersion", "people"]);
  });

  test("缺少的字段自动补齐", () => {
    const data = migrate({ schemaVersion: CURRENT_VERSION, settings: { apiKey: "k" } });
    equal([data.gifts, data.settings.apiKey, data.settings.rangeDays], [[], "k", 30]);
  });

  test("无法识别的数据会报错（不能覆盖现有数据）", async () => {
    await throws(() => migrate(null), "无法识别");
    await throws(() => migrate({ people: [] }), "版本号");
    await throws(() => migrate({ schemaVersion: CURRENT_VERSION + 1 }), "更新版本");
    await throws(() => migrate({ schemaVersion: CURRENT_VERSION, people: "x" }), "people");
  });
});

// ---------------- 存储 ----------------
group("数据存取（store.js，使用测试数据库）", () => {
  const mary = {
    name: "  Mary ",
    category: "friend",
    birthday: { year: 2000, month: 3, day: 14 },
    tags: ["芭蕾风", " 芭蕾风", "", "Jellycat"],
  };

  test("空数据库 → 默认数据", async () => {
    const s = await store.loadState();
    equal([s.schemaVersion, s.people.length], [CURRENT_VERSION, 0]);
  });

  test("添加朋友：名字去空格、标签去重、自动分配蛋的颜色", async () => {
    const p = await store.addPerson(mary);
    equal([p.name, p.tags, typeof p.eggColor], ["Mary", ["芭蕾风", "Jellycat"], "string"]);
  });

  test("重新读取后数据还在（确实存进了 IndexedDB）", async () => {
    const s = await store.loadState();
    equal(s.people.map((p) => p.name), ["Mary"]);
  });

  test("不合法的信息会报错，且数据不变", async () => {
    await throws(() => store.addPerson({ ...mary, name: " " }), "名字");
    await throws(() => store.addPerson({ ...mary, birthday: { year: 2025, month: 2, day: 29 } }), "这一天");
    await throws(() => store.addPerson({ ...mary, category: "pet" }), "朋友或家人");
    equal(store.getState().people.length, 1);
  });

  test("修改朋友信息", async () => {
    const id = store.getState().people[0].id;
    const p = await store.updatePerson(id, { name: "Mary W." });
    equal([p.name, p.birthday.month], ["Mary W.", 3]);
  });

  test("照片：存入再读出", async () => {
    const id = await store.savePhoto("data:image/jpeg;base64,AAAA");
    equal(await store.getPhoto(id), "data:image/jpeg;base64,AAAA");
  });

  test("礼物：添加后按日期从新到旧排列", async () => {
    const personId = store.getState().people[0].id;
    await store.addGift({ personId, name: "围巾", date: "2024-03-14" });
    await store.addGift({ personId, name: "挂件", date: "2025-03-14" });
    equal(store.listGifts(personId).map((g) => g.name), ["挂件", "围巾"]);
  });

  test("品类建议：用过的排在前面，不重复", async () => {
    const personId = store.getState().people[0].id;
    await store.addGift({ personId, name: "滑雪课", category: "体验" });
    const list = store.suggestGiftCategories();
    equal([list[0], list.filter((c) => c === "体验").length], ["体验", 1]);
  });

  test("编辑礼物时换照片，旧照片被删除", async () => {
    const personId = store.getState().people[0].id;
    const oldPhoto = await store.savePhoto("data:image/jpeg;base64,OLD");
    const gift = await store.addGift({ personId, name: "手链", photoId: oldPhoto });
    const newPhoto = await store.savePhoto("data:image/jpeg;base64,NEW");
    await store.updateGift(gift.id, { photoId: newPhoto });
    equal([await store.getPhoto(oldPhoto), await store.getPhoto(newPhoto)], [null, "data:image/jpeg;base64,NEW"]);
  });

  test("删除礼物：照片一起删除", async () => {
    const personId = store.getState().people[0].id;
    const photoId = await store.savePhoto("data:image/jpeg;base64,CCCC");
    const gift = await store.addGift({ personId, name: "香薰", photoId });
    await store.deleteGift(gift.id);
    equal([store.getGift(gift.id), await store.getPhoto(photoId)], [null, null]);
  });

  test("删除朋友：礼物、照片一起删除", async () => {
    const personId = store.getState().people[0].id;
    const photoId = await store.savePhoto("data:image/jpeg;base64,BBBB");
    await store.addGift({ personId, name: "相册", photoId });
    await store.deletePerson(personId);
    equal([store.getState().people.length, store.getState().gifts.length, await store.getPhoto(photoId)],
      [0, 0, null]);
  });

  test("持久存储申请有结果", async () => {
    const status = await store.requestPersistentStorage();
    if (!["granted", "denied", "unsupported"].includes(status)) throw new Error(status);
  });
});

// ---------------- 照片 ----------------
group("照片（photos.js）", () => {
  test("只接受图片 dataURL", () => {
    equal([
      isPhotoDataUrl("data:image/jpeg;base64,AAAA"),
      isPhotoDataUrl("data:text/html;base64,AAAA"),
      isPhotoDataUrl("javascript:alert(1)"),
      isPhotoDataUrl(null),
    ], [true, false, false, false]);
  });
});

// ---------------- 运行 ----------------
async function run() {
  // 每次都从空的测试数据库开始
  store.useDatabaseForTesting(TEST_DB);
  await clear(createStore(TEST_DB, "kv"));

  const results = document.getElementById("results");
  let passed = 0;
  let failed = 0;

  for (const g of groups) {
    const card = el("div", { class: "card" }, el("h2", {}, g.name));
    results.append(card);
    for (const t of g.tests) {
      try {
        await t.fn();
        passed++;
        card.append(el("p", { class: "result" }, "✅ ", t.name));
      } catch (err) {
        failed++;
        card.append(el("p", { class: "result fail" }, "❌ ", t.name,
          el("span", { class: "fail-detail" }, err.message)));
      }
    }
  }

  const summary = document.getElementById("summary");
  summary.textContent = failed ? `${failed} 项失败，${passed} 项通过` : `全部 ${passed} 项通过`;
  summary.className = failed ? "fail" : "summary-ok";
  results.append(el("p", { class: "muted" }, `持久存储：${store.getPersistStatus()}`));
}

run();
