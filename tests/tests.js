// 浏览器里运行的简单测试。打开 /tests/ 即可看到结果。
import { el } from "../js/ui/dom.js";
import { createStore, clear } from "../js/vendor/idb-keyval.js";
import * as dates from "../js/dates.js";
import { migrate, createDefaultData, CURRENT_VERSION } from "../js/schema.js";
import * as store from "../js/store.js";
import { isPhotoDataUrl, compressImage } from "../js/photos.js";
import { buildSampleData } from "../js/sample-data.js";
import { createBackup, parseBackup, importBackup, backupFileName, backupReminder } from "../js/backup.js";
import { callAI } from "../js/ai.js";
import { buildPrompt, parsePlans, incubate, findBudget, PLANS_SCHEMA, parseHints, parseIdeas, expandIdeas, cleanKeyword } from "../js/incubator-logic.js";
import { SHOP_PLATFORMS, buildSearchUrl, buildAppUrl, platformAction, isMobileDevice } from "../js/shop-platforms.js";

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

group("特殊日子（dates.js specialDaysOn）", () => {
  const P = (birthday, anniversaries = []) => ({ name: "A", birthday, anniversaries });
  const bd = (month, day, year = null) => ({ year, month, day });

  test("没有特殊日子 → 空列表", () => {
    equal(dates.specialDaysOn(P(bd(1, 1)), TODAY), []);
  });

  test("今天生日：返回生日和满几岁", () => {
    equal(dates.specialDaysOn(P(bd(10, 11, 2000)), TODAY), [{ type: "birthday", turningAge: 26 }]);
  });

  test("今天纪念日：返回名称和第几年；不知道年份时为 null", () => {
    const p = P(bd(1, 1), [{ name: "相识", month: 10, day: 11, year: 2018 }, { name: "第一次见面", month: 10, day: 11, year: null }]);
    equal(dates.specialDaysOn(p, TODAY).map((d) => [d.type, d.name, d.years]),
      [["anniversary", "第一次见面", null], ["anniversary", "相识", 8]]);
  });

  test("生日和纪念日同一天：生日排第一，其余是纪念日", () => {
    const p = P(bd(10, 11), [{ name: "相识", month: 10, day: 11, year: 2018 }, { name: "别的日子", month: 5, day: 1, year: null }]);
    equal(dates.specialDaysOn(p, TODAY).map((d) => d.type), ["birthday", "anniversary"]);
  });

  test("2 月 29 日的纪念日，非闰年在 2 月 28 日", () => {
    const p = P(bd(1, 1), [{ name: "闰日", month: 2, day: 29, year: 2020 }]);
    equal([dates.specialDaysOn(p, day(2027, 2, 28)).length, dates.specialDaysOn(p, day(2028, 2, 28)).length,
      dates.specialDaysOn(p, day(2028, 2, 29)).length], [1, 0, 1]);
  });

  test("没有 anniversaries 字段的旧数据也能用", () => {
    equal(dates.specialDaysOn({ name: "旧", birthday: bd(10, 11) }, TODAY).length, 1);
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

  test("示例数据：生日按今天推算（今天、2 天后、12 天后、60 天后）", () => {
    const { people } = buildSampleData(TODAY);
    equal(people.map((p) => dates.nextBirthday(p.birthday, TODAY).daysUntil), [0, 2, 12, 60]);
  });

  test("示例数据：年龄正确，礼物日期都不晚于今天", () => {
    const { people, gifts } = buildSampleData(TODAY);
    equal(dates.nextBirthday(people[0].birthday, TODAY).turningAge, 25);
    const late = gifts.filter((g) => g.date > dates.todayISO(TODAY));
    equal(late, []);
  });

  test("载入示例：人和礼物都标记 sample，并算作看过欢迎页", async () => {
    await store.addPerson({ name: "真朋友", category: "friend", birthday: { year: null, month: 5, day: 1 } });
    const result = await store.loadSampleData(buildSampleData());
    const s = store.getState();
    equal([result.people, s.people.filter((p) => p.sample).length, s.gifts.every((g) => g.sample),
      s.settings.onboarded, store.hasSampleData()], [4, 4, true, true, true]);
  });

  test("清除示例：只删示例，真实数据保留", async () => {
    const real = store.getState().people.find((p) => !p.sample);
    await store.addGift({ personId: real.id, name: "真礼物" });
    await store.clearSampleData();
    const s = store.getState();
    equal([s.people.map((p) => p.name), s.gifts.map((g) => g.name), store.hasSampleData()],
      [["真朋友"], ["真礼物"], false]);
  });

  test("纪念日：保存时检查名称和日期，自动编号", async () => {
    const real = store.getState().people.find((p) => !p.sample);
    await throws(() => store.updatePerson(real.id, { anniversaries: [{ name: "", month: 1, day: 1 }] }), "名称");
    await throws(() => store.updatePerson(real.id, { anniversaries: [{ name: "x", month: 2, day: 30 }] }), "这一天");
    await throws(() => store.updatePerson(real.id, { anniversaries: [{ name: "未来", month: 1, day: 1, year: 2999 }] }), "年份");
    const p = await store.updatePerson(real.id, { anniversaries: [{ name: " 相识纪念日 ", month: 3, day: 14, year: 2018 }] });
    equal([p.anniversaries.length, p.anniversaries[0].name, typeof p.anniversaries[0].id], [1, "相识纪念日", "string"]);
  });

  test("示例数据：小桃今天生日 + 纪念日，Lily 只有纪念日", () => {
    const { people } = buildSampleData(TODAY);
    const kinds = (p) => dates.specialDaysOn(p, TODAY).map((d) => d.type);
    equal([kinds(people[0]), kinds(people[1]), kinds(people[2])], [["birthday", "anniversary"], ["anniversary"], []]);
  });

  test("持久存储申请有结果", async () => {
    const status = await store.requestPersistentStorage();
    if (!["granted", "denied", "unsupported"].includes(status)) throw new Error(status);
  });
});

// ---------------- 备份 ----------------
group("备份（backup.js，使用测试数据库）", () => {
  test("导出：不包含 API 密钥，包含照片", async () => {
    await store.updateSettings({ apiKey: "sk-ant-SECRET" });
    const personId = store.getState().people[0].id;
    const photoId = await store.savePhoto("data:image/jpeg;base64,PHOTO");
    await store.addGift({ personId, name: "有照片的礼物", photoId });
    const backup = await createBackup();
    const text = JSON.stringify(backup);
    equal([text.includes("SECRET"), backup.app, backup.photos[photoId]],
      [false, "tamago", "data:image/jpeg;base64,PHOTO"]);
  });

  test("导出再读回：人数、礼物数、照片数一致", async () => {
    const s = store.getState();
    const parsed = parseBackup(JSON.stringify(await createBackup()));
    equal([parsed.summary.people, parsed.summary.gifts, parsed.summary.photos],
      [s.people.length, s.gifts.length, 1]);
  });

  test("备份提醒：超过 14 天才提醒；从没备份过时从登记第一个人算起；没有人不提醒", () => {
    const st = (lastBackupAt, createdAt = ["2026-09-01T08:00:00Z"]) => ({
      settings: { lastBackupAt }, people: createdAt.map((c) => ({ createdAt: c })) });
    equal([
      backupReminder(st("2026-09-27T08:00:00Z"), TODAY).due,             // 14 天：还不提醒
      backupReminder(st("2026-09-26T08:00:00Z"), TODAY),                  // 15 天：提醒
      backupReminder(st(null, ["2026-10-05T08:00:00Z"]), TODAY).due,      // 从没备份，刚开始用 6 天
      backupReminder(st(null, ["2026-10-01T08:00:00Z", "2026-09-20T08:00:00Z"]), TODAY), // 从最早登记的 9/20 算起
      backupReminder({ settings: { lastBackupAt: null }, people: [] }, TODAY).due,
    ], [false, { due: true, days: 15, never: false }, false, { due: true, days: 21, never: true }, false]);
  });

  test("文件名带日期", () => {
    equal(backupFileName(TODAY), "tamago-backup-2026-10-11.json");
  });

  test("不是 JSON、不是 tamago、版本太新 → 拒绝", async () => {
    await throws(() => parseBackup("hello"), "无法识别");
    await throws(() => parseBackup(JSON.stringify({ app: "other", backupVersion: 1, data: {} })), "无法识别");
    await throws(() => parseBackup(JSON.stringify({ app: "tamago", backupVersion: 99, data: {} })), "更新版本");
  });

  test("内容损坏（礼物找不到人、生日不对）→ 整份拒绝", async () => {
    const good = await createBackup();
    const badGift = structuredClone(good);
    badGift.data.gifts[0].personId = "p_不存在";
    await throws(() => parseBackup(JSON.stringify(badGift)), "找不到对应的人");
    const badBirthday = structuredClone(good);
    badBirthday.data.people[0].birthday = { month: 13, day: 1 };
    await throws(() => parseBackup(JSON.stringify(badBirthday)), "生日");
  });

  test("照片不是图片 → 去掉照片，礼物保留", async () => {
    const backup = await createBackup();
    const [id] = Object.keys(backup.photos);
    backup.photos[id] = "javascript:alert(1)";
    const parsed = parseBackup(JSON.stringify(backup));
    equal([parsed.summary.missingPhotos, parsed.data.gifts.some((g) => g.photoId === id)], [1, false]);
  });

  test("导入：替换全部数据，保留本机密钥，忽略文件里的密钥，清掉用不到的旧照片", async () => {
    const backup = await createBackup();
    backup.data.settings.apiKey = "sk-ant-FROM-FILE";
    backup.data.people = backup.data.people.slice(0, 1);
    backup.data.gifts = backup.data.gifts.filter((g) => g.personId === backup.data.people[0].id && !g.photoId);
    const orphanPhoto = await store.savePhoto("data:image/jpeg;base64,ORPHAN");
    await importBackup(parseBackup(JSON.stringify(backup)));
    const s = store.getState();
    equal([s.people.length, s.settings.apiKey, await store.getPhoto(orphanPhoto)], [1, "sk-ant-SECRET", null]);
  });

  test("纪念日包含在备份里；格式不对的纪念日 → 整份拒绝", async () => {
    const backup = await createBackup();
    const withAnniv = backup.data.people.find((p) => p.anniversaries?.length);
    const parsed = parseBackup(JSON.stringify(backup));
    equal(parsed.data.people.find((p) => p.id === withAnniv.id).anniversaries.map((a) => a.name), ["相识纪念日"]);
    withAnniv.anniversaries = [{ name: "坏的", month: 13, day: 1 }];
    await throws(() => parseBackup(JSON.stringify(backup)), "纪念日");
  });

  test("导入后重新读取，数据还在", async () => {
    const before = store.getState().people.map((p) => p.name);
    const s = await store.loadState();
    equal(s.people.map((p) => p.name), before);
  });
});

// ---------------- 灵感孵化 ----------------
// 不真的联网：把 fetch 换成假的，按顺序返回准备好的回答
function fakeFetch(responses) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    const r = responses[Math.min(calls.length - 1, responses.length - 1)];
    if (r instanceof Error) throw r;
    return new Response(JSON.stringify(r.body), { status: r.status ?? 200 });
  };
  return { calls, restore: () => { globalThis.fetch = original; } };
}
const textReply = (text, extra = {}) => ({
  body: { content: [{ type: "thinking", thinking: "" }, { type: "text", text }], stop_reason: "end_turn", ...extra },
});
const PLAN = (label, category, ids = []) => ({
  label, name: `礼物${label}`, category, priceRange: "约 300 元", style: "实用",
  reason: "因为 TA 喜欢芭蕾风。", matchedTags: ["芭蕾风"], sameCategoryGiftIds: ids,
});
const GIFTS = [
  { id: "g1", name: "芭蕾挂件", category: "饰品", date: "2025-03-14", occasion: "生日", reaction: "超喜欢" },
  { id: "g2", name: "香薰", category: "家居", date: "2024-03-14", occasion: "生日", reaction: "" },
];

group("灵感孵化（ai.js / incubator-logic.js，模拟 AI 回答，不真的联网）", () => {
  test("请求格式：地址、密钥、浏览器直连、模型、结构化输出、备用模型", async () => {
    const f = fakeFetch([textReply('{"ok":true}')]);
    try {
      const text = await callAI({ system: "S", prompt: "P", schema: PLANS_SCHEMA });
      const { url, init, body } = f.calls[0];
      equal([
        text, url, init.headers["x-api-key"], init.headers["anthropic-dangerous-direct-browser-access"],
        init.headers["anthropic-version"], init.headers["anthropic-beta"], body.model,
        body.output_config.format.type, body.output_config.effort, body.fallbacks, body.messages[0].content,
      ], [
        '{"ok":true}', "https://api.anthropic.com/v1/messages", "sk-ant-SECRET", "true",
        "2023-06-01", "server-side-fallback-2026-07-01", "claude-sonnet-5-5",
        "json_schema", "medium", "default", "P",
      ]);
    } finally { f.restore(); }
  });

  test("错误翻译成中文：密钥不对、余额不足、太忙、断网、被拒绝", async () => {
    const cases = [
      [{ status: 401, body: { error: { message: "invalid x-api-key" } } }, "auth"],
      [{ status: 400, body: { error: { message: "Your credit balance is too low" } } }, "billing"],
      [{ status: 529, body: {} }, "overloaded"],
      [new TypeError("Failed to fetch"), "network"],
      [textReply("", { stop_reason: "refusal" }), "refusal"],
    ];
    const codes = [];
    for (const [reply] of cases) {
      const f = fakeFetch([reply]);
      try { await callAI({ system: "S", prompt: "P" }); codes.push("没报错"); }
      catch (err) { codes.push(err.code); }
      finally { f.restore(); }
    }
    equal(codes, cases.map((c) => c[1]));
  });

  test("没填密钥：不发请求，直接提示去设置", async () => {
    const f = fakeFetch([textReply("x")]);
    await store.updateSettings({ apiKey: "" });
    try {
      await throws(() => callAI({ system: "S", prompt: "P" }), "API 密钥");
      equal(f.calls.length, 0);
    } finally {
      f.restore();
      await store.updateSettings({ apiKey: "sk-ant-SECRET" });
    }
  });

  test("提示词包含标签、礼物编号、预算和场合；只发文字", () => {
    const person = { name: "Mary", category: "friend", birthday: { year: 2000, month: 3, day: 14 }, tags: ["芭蕾风"] };
    const { prompt } = buildPrompt({ person, gifts: GIFTS, budget: findBudget("200-500"), occasion: "生日", today: TODAY });
    equal([prompt.includes("- 芭蕾风"), prompt.includes("[g1] 芭蕾挂件"), prompt.includes("200 到 500 元"),
      prompt.includes("场合：生日"), prompt.includes("26 岁"), prompt.includes("data:image")],
      [true, true, true, true, true, false]);
  });

  test("没有标签时提示词写明", () => {
    const person = { name: "A", category: "family", birthday: { year: null, month: 1, day: 1 }, tags: [] };
    const { prompt } = buildPrompt({ person, gifts: [], budget: findBudget("lt200"), occasion: "新年", today: TODAY });
    equal([prompt.includes("（还没有标签）"), prompt.includes("年龄：不详"), prompt.includes("关系：家人")], [true, true, true]);
  });

  test("同品类：采用 AI 标出的礼物，忽略不存在的编号，并按品类文字补充", () => {
    const text = JSON.stringify({ plans: [PLAN("A", "饰品", ["g1", "g-不存在"]), PLAN("B", "家居")] });
    const [a, b] = parsePlans(text, GIFTS);
    equal([a.sameCategoryGifts.map((g) => g.id), b.sameCategoryGifts.map((g) => g.id)], [["g1"], ["g2"]]);
  });

  test("回答格式不对：不是 JSON、方案数量不对、缺内容 → 报错", async () => {
    await throws(() => parsePlans("这不是 JSON", GIFTS), "格式不对");
    await throws(() => parsePlans(JSON.stringify({ plans: [PLAN("A", "饰品")] }), GIFTS), "数量");
    await throws(() => parsePlans(JSON.stringify({ plans: [PLAN("A", "饰品"), { ...PLAN("B", "x"), name: "" }] }), GIFTS), "缺少");
  });

  test("孵化：第一次格式不对会自动重试一次", async () => {
    const good = JSON.stringify({ plans: [PLAN("A", "体验"), PLAN("B", "书籍")] });
    const f = fakeFetch([textReply("坏掉的回答"), textReply(good)]);
    try {
      const person = store.getState().people[0];
      const plans = await incubate({ person, gifts: [], budget: findBudget("lt200"), occasion: "生日" });
      equal([f.calls.length, plans.map((p) => p.label)], [2, ["A", "B"]]);
    } finally { f.restore(); }
  });

  test("提示词：按逗号、顿号、空格分开，去重", () => {
    equal(parseHints(" 可爱，小众、可爱  能天天用 "), ["可爱", "小众", "能天天用"]);
  });

  test("重新孵化的提示词：写入提示词、不喜欢的方案、已推荐过的方案", () => {
    const person = { name: "A", category: "friend", birthday: { year: null, month: 1, day: 1 }, tags: [] };
    const shown = { name: "香薰蜡烛", category: "家居", style: "实用" };
    const disliked = { name: "保温杯", category: "家居", style: "实用" };
    const { prompt } = buildPrompt({ person, gifts: [], budget: findBudget("lt200"), occasion: "生日",
      hints: ["手作"], avoid: [shown, disliked], disliked: [disliked], today: TODAY });
    equal([prompt.includes("- 手作"), prompt.includes("不喜欢这些方案"), prompt.includes("- 保温杯（家居"),
      prompt.includes("- 香薰蜡烛"), prompt.split("保温杯").length - 1], [true, true, true, true, 1]);
  });

  test("灵感清单：3–5 个方向，关键词最多 2 个，像网址的关键词丢掉", () => {
    const idea = (t, keywords) => ({ title: t, note: "适合", keywords });
    const ideas = parseIdeas(JSON.stringify({ ideas: [
      idea("一", ["发夹", "hair clip", "多余的"]),
      idea("二", ["https://item.taobao.com/x", "芭蕾 发饰"]),
      idea("三", ["www.example.com"]),
      idea("四", ["珍珠发夹"]), idea("五", ["相册"]), idea("六", ["胶卷"]), idea("七", ["手链"]),
    ] }));
    equal([ideas.length, ideas[0].keywords, ideas[1].keywords, ideas.map((i) => i.title)],
      [5, ["发夹", "hair clip"], ["芭蕾 发饰"], ["一", "二", "四", "五", "六"]]);
  });

  test("灵感清单：少于 3 个方向 → 报错", async () => {
    await throws(() => parseIdeas(JSON.stringify({ ideas: [{ title: "一", note: "", keywords: ["a"] }] })), "太少");
    equal([cleanKeyword("taobao.com 发夹"), cleanKeyword(" 发夹 "), cleanKeyword("a/b")], [null, "发夹", null]);
  });

  test("搜索链接：只用配置的模板拼接，关键词会编码，都是 https", () => {
    const urls = SHOP_PLATFORMS.map((p) => buildSearchUrl(p, "芭蕾 发夹&x"));
    equal([urls.every((u) => u.startsWith("https://")), urls.every((u) => u.includes(encodeURIComponent("芭蕾 发夹&x"))),
      buildSearchUrl({ url: "javascript:alert({q})" }, "x"), buildSearchUrl({ url: "http://a.com/?q={q}" }, "x")],
      [true, true, null, null]);
  });

  test("手机上淘宝、小红书先打开 App，Amazon 打开网页；电脑上都打开网页", () => {
    const by = (id) => SHOP_PLATFORMS.find((p) => p.id === id);
    equal([platformAction(by("taobao"), true), platformAction(by("xiaohongshu"), true), platformAction(by("amazon"), true),
      platformAction(by("taobao"), false), platformAction(by("xiaohongshu"), false)],
      ["app", "app", "link", "link", "link"]);
  });

  test("App 地址：关键词会编码；开头不在白名单里的地址一律拒绝", () => {
    const by = (id) => SHOP_PLATFORMS.find((p) => p.id === id);
    equal([
      buildAppUrl(by("taobao"), "芭蕾 发夹&x"),
      buildAppUrl(by("xiaohongshu"), "发夹"),
      buildAppUrl({ appUrl: "javascript://alert({q})" }, "x"),
      buildAppUrl({ appUrl: "https://evil.example/{q}" }, "x"),
      buildAppUrl({}, "x"),
    ], [
      "taobao://s.taobao.com/search?q=" + encodeURIComponent("芭蕾 发夹&x"),
      "xhsdiscover://search/result?keyword=" + encodeURIComponent("发夹"),
      null, null, null,
    ]);
  });

  test("识别手机：iPhone、安卓、伪装成 Mac 的 iPad 算手机，Mac 电脑不算", () => {
    const ua = (userAgent, maxTouchPoints = 0) => ({ userAgent, maxTouchPoints });
    equal([
      isMobileDevice(ua("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148 Safari/604.1")),
      isMobileDevice(ua("Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Safari/537.36")),
      isMobileDevice(ua("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15", 5)),
      isMobileDevice(ua("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/131.0 Safari/537.36", 0)),
    ], [true, true, true, false]);
  });

  test("展开灵感清单：请求里要求不输出网址，回答是结构化格式", async () => {
    const reply = JSON.stringify({ ideas: [1, 2, 3].map((n) => ({ title: `方向${n}`, note: "", keywords: [`词${n}`] })) });
    const f = fakeFetch([textReply(reply)]);
    try {
      const person = { name: "A", category: "friend", birthday: { year: null, month: 1, day: 1 }, tags: ["芭蕾风"] };
      const plan = { name: "发夹", category: "饰品", style: "实用", reason: "因为" };
      const ideas = await expandIdeas({ person, plan, budget: findBudget("lt200"), occasion: "生日" });
      const body = f.calls[0].body;
      equal([ideas.length, body.system.includes("不要输出任何网址"), body.output_config.format.type,
        body.output_config.effort], [3, true, "json_schema", "low"]);
    } finally { f.restore(); }
  });

  test("孵化：两次都不对 → 提示重新孵化", async () => {
    const f = fakeFetch([textReply("坏"), textReply("还是坏")]);
    try {
      const person = store.getState().people[0];
      await throws(() => incubate({ person, gifts: [], budget: findBudget("lt200"), occasion: "生日" }), "重新孵化");
      equal(f.calls.length, 2);
    } finally { f.restore(); }
  });
});

group("偏好记录（更喜欢 / 不喜欢）", () => {
  test("记录不喜欢，并能通过备份导出再导入", async () => {
    const personId = store.getState().people[0].id;
    await store.addPreference({ personId, type: "prefer", chosen: { name: "A" }, rejected: { name: "B" } });
    await store.addPreference({ personId, type: "dislike", plan: { name: "C" } });
    const parsed = parseBackup(JSON.stringify(await createBackup()));
    const types = parsed.data.preferences.map((p) => p.type);
    equal([types.includes("prefer"), types.includes("dislike"),
      parsed.data.preferences.find((p) => p.type === "dislike").plan.name], [true, true, "C"]);
  });

  test("旧格式（没有 type）的偏好记录导入后当作「更喜欢」", async () => {
    const backup = await createBackup();
    const personId = backup.data.people[0].id;
    backup.data.preferences = [{ id: "pref_old", personId, chosen: { name: "旧" }, rejected: null }];
    equal(parseBackup(JSON.stringify(backup)).data.preferences[0].type, "prefer");
  });
});

// ---------------- 照片 ----------------
group("照片（photos.js）", () => {
  test("照片过大：4000×3000 的图压缩到最长边 800，文件变小", async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 4000;
    canvas.height = 3000;
    const ctx = canvas.getContext("2d");
    // 画一些渐变和噪点，接近真实照片
    const g = ctx.createLinearGradient(0, 0, 4000, 3000);
    g.addColorStop(0, "#F7B8CB"); g.addColorStop(1, "#C9E6F7");
    ctx.fillStyle = g; ctx.fillRect(0, 0, 4000, 3000);
    for (let i = 0; i < 4000; i++) { ctx.fillStyle = `hsl(${i % 360},70%,60%)`; ctx.fillRect((i * 97) % 4000, (i * 61) % 3000, 40, 40); }
    const blob = await new Promise((r) => canvas.toBlob(r, "image/png"));
    const dataUrl = await compressImage(new File([blob], "big.png", { type: "image/png" }));
    const img = await new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = dataUrl; });
    const kb = Math.round((dataUrl.length * 0.75) / 1024);
    equal([img.naturalWidth, img.naturalHeight, dataUrl.startsWith("data:image/jpeg"), kb < 200], [800, 600, true, true]);
  });

  test("不是图片的文件 → 提示请选择图片", async () => {
    await throws(() => compressImage(new File(["hello"], "a.txt", { type: "text/plain" })), "图片");
  });

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
