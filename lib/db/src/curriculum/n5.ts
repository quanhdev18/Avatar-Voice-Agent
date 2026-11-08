import type { LessonSeed } from "./types";

/** First 10 JLPT N5 lessons for Vietnamese learners. */
export const N5_LESSONS: LessonSeed[] = [
  {
    id: "n5-01-hiragana",
    level: "N5",
    order: 1,
    title: "ひらがな あ〜な",
    titleVi: "Bảng chữ Hiragana (あ → な)",
    content: {
      objectivesVi: [
        "Đọc và phát âm 25 chữ hiragana đầu tiên (hàng あ, か, さ, た, な)",
        "Nhận ra các từ đơn giản viết bằng hiragana",
      ],
      vocab: [
        { kana: "あい", romaji: "ai", meaningVi: "tình yêu", example: "あい は たいせつ です。", exampleVi: "Tình yêu thì quan trọng." },
        { kana: "いえ", romaji: "ie", meaningVi: "ngôi nhà" },
        { kana: "うえ", romaji: "ue", meaningVi: "phía trên" },
        { kana: "かさ", romaji: "kasa", meaningVi: "cái ô (dù)" },
        { kana: "すし", romaji: "sushi", meaningVi: "sushi" },
        { kana: "ねこ", romaji: "neko", meaningVi: "con mèo" },
        { kana: "いぬ", romaji: "inu", meaningVi: "con chó" },
      ],
      grammar: [
        {
          pattern: "Nguyên âm あ い う え お",
          meaningVi: "5 nguyên âm cơ bản",
          explanationVi: "Tiếng Nhật chỉ có 5 nguyên âm: a, i, u, e, o. Chữ う đọc giữa 'u' và 'ư', môi không tròn.",
          examples: [{ ja: "あおい", romaji: "aoi", vi: "màu xanh" }],
        },
      ],
      dialogue: [
        { speaker: "Yuki", ja: "これは なんですか。「ねこ」。", romaji: "Kore wa nan desu ka. 'Neko'.", vi: "Đây là gì? 'Mèo'." },
      ],
      rolePlayVi: "Giáo viên viết 1 từ hiragana lên bảng, người học đọc to.",
    },
  },
  {
    id: "n5-02-greetings",
    level: "N5",
    order: 2,
    title: "あいさつ",
    titleVi: "Chào hỏi hằng ngày",
    content: {
      objectivesVi: ["Chào buổi sáng, trưa, tối", "Cảm ơn và xin lỗi lịch sự"],
      vocab: [
        { kana: "おはようございます", romaji: "ohayou gozaimasu", meaningVi: "chào buổi sáng (lịch sự)" },
        { kana: "こんにちは", romaji: "konnichiwa", meaningVi: "xin chào (ban ngày)" },
        { kana: "こんばんは", romaji: "konbanwa", meaningVi: "chào buổi tối" },
        { kana: "ありがとうございます", romaji: "arigatou gozaimasu", meaningVi: "cảm ơn (lịch sự)" },
        { kana: "すみません", romaji: "sumimasen", meaningVi: "xin lỗi / làm phiền" },
        { kana: "さようなら", romaji: "sayounara", meaningVi: "tạm biệt" },
        { kana: "おやすみなさい", romaji: "oyasuminasai", meaningVi: "chúc ngủ ngon" },
      ],
      grammar: [
        {
          pattern: "〜ございます",
          meaningVi: "thêm vào để lịch sự hơn",
          explanationVi: "おはよう là thân mật (bạn bè). おはようございます dùng với thầy cô, đồng nghiệp, người lớn tuổi.",
          examples: [{ ja: "せんせい、おはようございます。", romaji: "Sensei, ohayou gozaimasu.", vi: "Chào buổi sáng thầy/cô." }],
        },
      ],
      dialogue: [
        { speaker: "Yuki", ja: "こんにちは。", romaji: "Konnichiwa.", vi: "Xin chào." },
        { speaker: "Học viên", ja: "こんにちは、せんせい。", romaji: "Konnichiwa, sensei.", vi: "Chào cô ạ." },
        { speaker: "Yuki", ja: "ありがとうございます。", romaji: "Arigatou gozaimasu.", vi: "Cảm ơn." },
      ],
      rolePlayVi: "Gặp cô giáo lúc 8 giờ sáng ở cổng trường — hãy chào và cảm ơn.",
    },
  },
  {
    id: "n5-03-self-intro",
    level: "N5",
    order: 3,
    title: "じこしょうかい",
    titleVi: "Giới thiệu bản thân",
    content: {
      objectivesVi: ["Nói tên, quốc tịch, nghề nghiệp", "Dùng はじめまして / よろしくおねがいします"],
      vocab: [
        { kana: "はじめまして", romaji: "hajimemashite", meaningVi: "rất vui được gặp (lần đầu)" },
        { kanji: "私", kana: "わたし", romaji: "watashi", meaningVi: "tôi" },
        { kanji: "名前", kana: "なまえ", romaji: "namae", meaningVi: "tên" },
        { kanji: "ベトナム人", kana: "ベトナムじん", romaji: "betonamujin", meaningVi: "người Việt Nam" },
        { kanji: "学生", kana: "がくせい", romaji: "gakusei", meaningVi: "học sinh, sinh viên" },
        { kanji: "会社員", kana: "かいしゃいん", romaji: "kaishain", meaningVi: "nhân viên công ty" },
        { kana: "よろしくおねがいします", romaji: "yoroshiku onegaishimasu", meaningVi: "rất mong được giúp đỡ" },
      ],
      grammar: [
        {
          pattern: "N1 は N2 です",
          meaningVi: "N1 là N2",
          explanationVi: "は (đọc là 'wa') đánh dấu chủ đề. です đặt cuối câu để lịch sự.",
          examples: [
            { ja: "わたしは アンです。", romaji: "Watashi wa An desu.", vi: "Tôi là An." },
            { ja: "わたしは ベトナムじんです。", romaji: "Watashi wa betonamujin desu.", vi: "Tôi là người Việt Nam." },
          ],
        },
      ],
      dialogue: [
        { speaker: "Yuki", ja: "はじめまして。ゆきです。", romaji: "Hajimemashite. Yuki desu.", vi: "Rất vui được gặp. Tôi là Yuki." },
        { speaker: "Học viên", ja: "はじめまして。アンです。ベトナムじんです。よろしくおねがいします。", romaji: "Hajimemashite. An desu. Betonamujin desu. Yoroshiku onegaishimasu.", vi: "Rất vui được gặp. Tôi là An, người Việt Nam. Rất mong được giúp đỡ." },
      ],
      rolePlayVi: "Ngày đầu đi làm ở công ty Nhật — giới thiệu bản thân với trưởng phòng.",
    },
  },
  {
    id: "n5-04-numbers",
    level: "N5",
    order: 4,
    title: "かず",
    titleVi: "Số đếm 1–100",
    content: {
      objectivesVi: ["Đếm từ 1 đến 100", "Hỏi và nói số điện thoại, tuổi"],
      vocab: [
        { kanji: "一", kana: "いち", romaji: "ichi", meaningVi: "một" },
        { kanji: "二", kana: "に", romaji: "ni", meaningVi: "hai" },
        { kanji: "三", kana: "さん", romaji: "san", meaningVi: "ba" },
        { kanji: "四", kana: "よん / し", romaji: "yon / shi", meaningVi: "bốn" },
        { kanji: "五", kana: "ご", romaji: "go", meaningVi: "năm" },
        { kanji: "十", kana: "じゅう", romaji: "juu", meaningVi: "mười" },
        { kanji: "百", kana: "ひゃく", romaji: "hyaku", meaningVi: "một trăm" },
        { kanji: "何歳", kana: "なんさい", romaji: "nansai", meaningVi: "bao nhiêu tuổi" },
      ],
      grammar: [
        {
          pattern: "Số chục = số × 十 + số",
          meaningVi: "Ghép số",
          explanationVi: "Giống tiếng Việt: 25 = に じゅう ご (hai mươi lăm).",
          examples: [{ ja: "にじゅうご", romaji: "nijuugo", vi: "25" }],
        },
        {
          pattern: "〜さいです",
          meaningVi: "... tuổi",
          explanationVi: "Lưu ý: 20 tuổi đọc đặc biệt là はたち.",
          examples: [{ ja: "わたしは にじゅうさんさいです。", romaji: "Watashi wa nijuusan sai desu.", vi: "Tôi 23 tuổi." }],
        },
      ],
      dialogue: [
        { speaker: "Yuki", ja: "なんさいですか。", romaji: "Nansai desu ka.", vi: "Bạn bao nhiêu tuổi?" },
        { speaker: "Học viên", ja: "にじゅうよんさいです。", romaji: "Nijuuyon sai desu.", vi: "Tôi 24 tuổi." },
      ],
      rolePlayVi: "Đăng ký thẻ thành viên: nói tuổi và số điện thoại.",
    },
  },
  {
    id: "n5-05-desu-question",
    level: "N5",
    order: 5,
    title: "〜ですか / 〜じゃありません",
    titleVi: "Câu hỏi và phủ định với です",
    content: {
      objectivesVi: ["Đặt câu hỏi có/không với か", "Phủ định với じゃありません"],
      vocab: [
        { kanji: "先生", kana: "せんせい", romaji: "sensei", meaningVi: "giáo viên" },
        { kanji: "医者", kana: "いしゃ", romaji: "isha", meaningVi: "bác sĩ" },
        { kana: "はい", romaji: "hai", meaningVi: "vâng, có" },
        { kana: "いいえ", romaji: "iie", meaningVi: "không" },
        { kanji: "日本人", kana: "にほんじん", romaji: "nihonjin", meaningVi: "người Nhật" },
      ],
      grammar: [
        {
          pattern: "N は N ですか",
          meaningVi: "... có phải là ... không?",
          explanationVi: "Thêm か vào cuối câu để thành câu hỏi, lên giọng nhẹ ở cuối.",
          examples: [{ ja: "やまださんは せんせいですか。", romaji: "Yamada-san wa sensei desu ka.", vi: "Anh Yamada có phải giáo viên không?" }],
        },
        {
          pattern: "N じゃありません",
          meaningVi: "không phải là N",
          explanationVi: "Dạng phủ định của です. Văn viết dùng ではありません.",
          examples: [{ ja: "わたしは にほんじんじゃありません。", romaji: "Watashi wa nihonjin ja arimasen.", vi: "Tôi không phải người Nhật." }],
        },
      ],
      dialogue: [
        { speaker: "Yuki", ja: "アンさんは いしゃですか。", romaji: "An-san wa isha desu ka.", vi: "An có phải bác sĩ không?" },
        { speaker: "Học viên", ja: "いいえ、いしゃじゃありません。がくせいです。", romaji: "Iie, isha ja arimasen. Gakusei desu.", vi: "Không, tôi không phải bác sĩ. Tôi là sinh viên." },
      ],
      rolePlayVi: "Đoán nghề nghiệp của nhau bằng câu hỏi có/không.",
    },
  },
  {
    id: "n5-06-kore-sore-are",
    level: "N5",
    order: 6,
    title: "これ・それ・あれ",
    titleVi: "Cái này, cái đó, cái kia",
    content: {
      objectivesVi: ["Chỉ đồ vật theo khoảng cách", "Hỏi なんですか"],
      vocab: [
        { kana: "これ", romaji: "kore", meaningVi: "cái này (gần tôi)" },
        { kana: "それ", romaji: "sore", meaningVi: "cái đó (gần bạn)" },
        { kana: "あれ", romaji: "are", meaningVi: "cái kia (xa cả hai)" },
        { kanji: "本", kana: "ほん", romaji: "hon", meaningVi: "quyển sách" },
        { kanji: "傘", kana: "かさ", romaji: "kasa", meaningVi: "cái ô" },
        { kanji: "時計", kana: "とけい", romaji: "tokei", meaningVi: "đồng hồ" },
      ],
      grammar: [
        {
          pattern: "これは なんですか",
          meaningVi: "Đây là cái gì?",
          explanationVi: "なん = gì. Trả lời: それは 〜です.",
          examples: [{ ja: "これは なんですか。…それは ほんです。", romaji: "Kore wa nan desu ka. … Sore wa hon desu.", vi: "Đây là gì? … Đó là quyển sách." }],
        },
        {
          pattern: "N1 の N2",
          meaningVi: "N2 của N1",
          explanationVi: "の nối hai danh từ, thứ tự ngược tiếng Việt: わたしの ほん = sách của tôi.",
          examples: [{ ja: "それは わたしの かさです。", romaji: "Sore wa watashi no kasa desu.", vi: "Đó là cái ô của tôi." }],
        },
      ],
      dialogue: [
        { speaker: "Yuki", ja: "あれは なんですか。", romaji: "Are wa nan desu ka.", vi: "Kia là cái gì?" },
        { speaker: "Học viên", ja: "あれは とけいです。", romaji: "Are wa tokei desu.", vi: "Kia là đồng hồ." },
      ],
      rolePlayVi: "Ở phòng thất lạc đồ: hỏi xem cái ô này có phải của ai không.",
    },
  },
  {
    id: "n5-07-wa-ga",
    level: "N5",
    order: 7,
    title: "は と が",
    titleVi: "Phân biệt は và が",
    content: {
      objectivesVi: ["Hiểu は = chủ đề, が = chủ ngữ mới / nhấn mạnh", "Dùng 〜が すきです"],
      vocab: [
        { kanji: "好き", kana: "すき", romaji: "suki", meaningVi: "thích" },
        { kanji: "猫", kana: "ねこ", romaji: "neko", meaningVi: "con mèo" },
        { kanji: "誰", kana: "だれ", romaji: "dare", meaningVi: "ai" },
        { kanji: "音楽", kana: "おんがく", romaji: "ongaku", meaningVi: "âm nhạc" },
        { kana: "ラーメン", romaji: "raamen", meaningVi: "mì ramen" },
      ],
      grammar: [
        {
          pattern: "N が すきです",
          meaningVi: "thích N",
          explanationVi: "Với すき, đối tượng được thích đi với が (không phải を).",
          examples: [{ ja: "わたしは ラーメンが すきです。", romaji: "Watashi wa raamen ga suki desu.", vi: "Tôi thích ramen." }],
        },
        {
          pattern: "だれが 〜ですか",
          meaningVi: "Ai là ...?",
          explanationVi: "Từ để hỏi (だれ, なに) làm chủ ngữ thì luôn đi với が, không dùng は.",
          examples: [{ ja: "だれが せんせいですか。", romaji: "Dare ga sensei desu ka.", vi: "Ai là giáo viên?" }],
        },
      ],
      dialogue: [
        { speaker: "Yuki", ja: "アンさんは なにが すきですか。", romaji: "An-san wa nani ga suki desu ka.", vi: "An thích gì?" },
        { speaker: "Học viên", ja: "わたしは おんがくが すきです。", romaji: "Watashi wa ongaku ga suki desu.", vi: "Tôi thích âm nhạc." },
      ],
      rolePlayVi: "Nói chuyện với bạn mới về sở thích: đồ ăn, âm nhạc, con vật.",
    },
  },
  {
    id: "n5-08-masu",
    level: "N5",
    order: 8,
    title: "〜ます",
    titleVi: "Động từ thể ます (hiện tại / tương lai)",
    content: {
      objectivesVi: ["Chia động từ ở thể ます / ません", "Nói thói quen hằng ngày"],
      vocab: [
        { kanji: "行きます", kana: "いきます", romaji: "ikimasu", meaningVi: "đi" },
        { kanji: "来ます", kana: "きます", romaji: "kimasu", meaningVi: "đến" },
        { kanji: "寝ます", kana: "ねます", romaji: "nemasu", meaningVi: "ngủ" },
        { kanji: "起きます", kana: "おきます", romaji: "okimasu", meaningVi: "thức dậy" },
        { kanji: "毎日", kana: "まいにち", romaji: "mainichi", meaningVi: "mỗi ngày" },
        { kanji: "学校", kana: "がっこう", romaji: "gakkou", meaningVi: "trường học" },
      ],
      grammar: [
        {
          pattern: "V-ます / V-ません",
          meaningVi: "làm / không làm",
          explanationVi: "ます dùng cho hiện tại và tương lai, lịch sự. Phủ định đổi ます → ません.",
          examples: [
            { ja: "まいにち がっこうへ いきます。", romaji: "Mainichi gakkou e ikimasu.", vi: "Mỗi ngày tôi đi học." },
            { ja: "あした がっこうへ いきません。", romaji: "Ashita gakkou e ikimasen.", vi: "Ngày mai tôi không đi học." },
          ],
        },
        {
          pattern: "場所 へ 行きます",
          meaningVi: "đi đến địa điểm",
          explanationVi: "へ (đọc là 'e') chỉ hướng di chuyển.",
          examples: [{ ja: "にほんへ いきます。", romaji: "Nihon e ikimasu.", vi: "Tôi sẽ đi Nhật." }],
        },
      ],
      dialogue: [
        { speaker: "Yuki", ja: "なんじに おきますか。", romaji: "Nanji ni okimasu ka.", vi: "Bạn dậy lúc mấy giờ?" },
        { speaker: "Học viên", ja: "ろくじに おきます。", romaji: "Rokuji ni okimasu.", vi: "Tôi dậy lúc 6 giờ." },
      ],
      rolePlayVi: "Kể về một ngày bình thường của bạn: dậy, đi làm, về nhà, ngủ.",
    },
  },
  {
    id: "n5-09-wo",
    level: "N5",
    order: 9,
    title: "〜を 〜ます",
    titleVi: "Trợ từ を (tân ngữ)",
    content: {
      objectivesVi: ["Dùng を với ngoại động từ", "Nói mình ăn, uống, xem, đọc gì"],
      vocab: [
        { kanji: "食べます", kana: "たべます", romaji: "tabemasu", meaningVi: "ăn" },
        { kanji: "飲みます", kana: "のみます", romaji: "nomimasu", meaningVi: "uống" },
        { kanji: "見ます", kana: "みます", romaji: "mimasu", meaningVi: "xem, nhìn" },
        { kanji: "読みます", kana: "よみます", romaji: "yomimasu", meaningVi: "đọc" },
        { kanji: "水", kana: "みず", romaji: "mizu", meaningVi: "nước" },
        { kanji: "朝ご飯", kana: "あさごはん", romaji: "asagohan", meaningVi: "bữa sáng" },
      ],
      grammar: [
        {
          pattern: "N を V-ます",
          meaningVi: "làm (gì) N",
          explanationVi: "を (đọc là 'o') đánh dấu tân ngữ — vật bị tác động bởi hành động.",
          examples: [
            { ja: "みずを のみます。", romaji: "Mizu o nomimasu.", vi: "Tôi uống nước." },
            { ja: "あさごはんを たべません。", romaji: "Asagohan o tabemasen.", vi: "Tôi không ăn sáng." },
          ],
        },
        {
          pattern: "なにを 〜ますか",
          meaningVi: "làm gì?",
          explanationVi: "Hỏi tân ngữ bằng なにを.",
          examples: [{ ja: "なにを みますか。", romaji: "Nani o mimasu ka.", vi: "Bạn xem gì?" }],
        },
      ],
      dialogue: [
        { speaker: "Yuki", ja: "あさ、なにを たべますか。", romaji: "Asa, nani o tabemasu ka.", vi: "Buổi sáng bạn ăn gì?" },
        { speaker: "Học viên", ja: "フォーを たべます。", romaji: "Foo o tabemasu.", vi: "Tôi ăn phở." },
      ],
      rolePlayVi: "Gọi món ở quán cà phê: nói bạn muốn uống và ăn gì.",
    },
  },
  {
    id: "n5-10-time-ni",
    level: "N5",
    order: 10,
    title: "じかん と に",
    titleVi: "Giờ giấc và trợ từ に",
    content: {
      objectivesVi: ["Nói giờ, phút", "Dùng に cho thời điểm cụ thể", "Ôn tập bài 1–9"],
      vocab: [
        { kanji: "今", kana: "いま", romaji: "ima", meaningVi: "bây giờ" },
        { kanji: "〜時", kana: "〜じ", romaji: "~ji", meaningVi: "... giờ" },
        { kanji: "〜分", kana: "〜ふん / ぷん", romaji: "~fun / pun", meaningVi: "... phút" },
        { kanji: "半", kana: "はん", romaji: "han", meaningVi: "rưỡi" },
        { kanji: "午前", kana: "ごぜん", romaji: "gozen", meaningVi: "buổi sáng (AM)" },
        { kanji: "午後", kana: "ごご", romaji: "gogo", meaningVi: "buổi chiều (PM)" },
      ],
      grammar: [
        {
          pattern: "いま なんじですか",
          meaningVi: "Bây giờ là mấy giờ?",
          explanationVi: "Chú ý đọc đặc biệt: 4 giờ = よじ, 7 giờ = しちじ, 9 giờ = くじ.",
          examples: [{ ja: "いま、ごご さんじはんです。", romaji: "Ima, gogo sanji han desu.", vi: "Bây giờ là 3 giờ rưỡi chiều." }],
        },
        {
          pattern: "時間 に V-ます",
          meaningVi: "làm gì vào lúc ...",
          explanationVi: "に đi sau thời điểm có số (7じに). Không dùng に với まいにち, あした.",
          examples: [{ ja: "しちじに おきます。", romaji: "Shichiji ni okimasu.", vi: "Tôi dậy lúc 7 giờ." }],
        },
      ],
      dialogue: [
        { speaker: "Yuki", ja: "いま なんじですか。", romaji: "Ima nanji desu ka.", vi: "Bây giờ mấy giờ?" },
        { speaker: "Học viên", ja: "くじ じゅうごふんです。", romaji: "Kuji juugofun desu.", vi: "9 giờ 15 phút." },
      ],
      rolePlayVi: "Hẹn giờ gặp bạn: hỏi giờ bạn rảnh và chốt giờ gặp.",
    },
  },
];
