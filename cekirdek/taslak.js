// Şefe yazdırılan taslaklar için istem metinleri ve gelen yanıtın temizlenmesi.
const kisa = (s, n) => String(s ?? '').trim().slice(0, n);

function ekipOzeti(sirket) {
  if (!sirket.ajanlar.length) return sirket.dil === 'en' ? 'Nobody yet.' : 'Henüz kimse yok.';
  return sirket.ajanlar.map((a) => `${a.ad}: ${a.unvan}${a.alanlar.length ? ' (' + a.alanlar.join(', ') + ')' : ''}`).join('\n');
}

export function ajanIstemi(sirket, tarif) {
  if (sirket.dil === 'en') {
    return `You are setting up a new team member for a company called "${sirket.ad}" that runs on Claude Code agents.

What the user wants: ${kisa(tarif, 2000)}

Current team:
${ekipOzeti(sirket)}

Write the new member's profile. Use plain, direct English. No hyphens or dashes inside sentences.
"ad" is a short first name for the person (not a job title, and not a name already on the team).
"unvan" is their ability in two to four words.
"alanlar" is three to five short areas they take care of.
"cagri" is one sentence telling the chief when to call this person.
"talimat" is the working instructions: one sentence on who they are, then five to eight numbered, concrete rules of practice for this job. Do not repeat company wide rules.
"kurallar" is zero to three hard limits specific to this person.

Return only one JSON object in exactly this shape and nothing else:
{"ad":"","unvan":"","alanlar":[""],"cagri":"","talimat":"","kurallar":[""]}`;
  }
  return `"${sirket.ad}" adlı, Claude Code ajanlarıyla çalışan bir şirkete yeni bir ekip üyesi kuruyorsun.

Kullanıcının isteği: ${kisa(tarif, 2000)}

Mevcut ekip:
${ekipOzeti(sirket)}

Yeni üyenin profilini yaz. Sade ve net Türkçe kullan. Cümle içinde tire ve uzun çizgi kullanma.
"ad": kişinin kısa adı (unvan değil, ekipte olan bir ad da değil).
"unvan": kabiliyeti, iki ile dört kelime.
"alanlar": ilgilendiği üç ile beş kısa alan.
"cagri": şefe bu kişiyi ne zaman çağıracağını anlatan tek cümle.
"talimat": çalışma talimatı. Önce kim olduğunu anlatan tek cümle, sonra bu işe özel beş ile sekiz numaralı, somut çalışma kuralı. Şirket genelindeki kuralları tekrarlama.
"kurallar": bu kişiye özel sıfır ile üç kesin sınır.

Yalnızca tam şu biçimde tek bir JSON nesnesi döndür, başka hiçbir şey yazma:
{"ad":"","unvan":"","alanlar":[""],"cagri":"","talimat":"","kurallar":[""]}`;
}

export function kuralIstemi(sirket, tarif) {
  const mevcut = sirket.kurallar.map((k, i) => `${i + 1}. ${k.metin}`).join('\n') || (sirket.dil === 'en' ? 'None.' : 'Yok.');
  if (sirket.dil === 'en') {
    return `You are writing company rules for "${sirket.ad}", a company run by Claude Code agents. Every agent reads these rules before every job.

What the user wants: ${kisa(tarif, 2000)}

Team:
${ekipOzeti(sirket)}

Rules that already exist (do not repeat them):
${mevcut}

Write three to six new rules. Each rule is one or two plain sentences, concrete enough that an agent can tell whether it broke it. No hyphens or dashes inside sentences.

Return only one JSON object in exactly this shape and nothing else:
{"kurallar":[""]}`;
  }
  return `"${sirket.ad}" adlı, Claude Code ajanlarıyla çalışan şirket için şirket kuralı yazıyorsun. Her ajan her işten önce bu kuralları okur.

Kullanıcının isteği: ${kisa(tarif, 2000)}

Ekip:
${ekipOzeti(sirket)}

Zaten var olan kurallar (tekrarlama):
${mevcut}

Üç ile altı yeni kural yaz. Her kural bir ya da iki sade cümle olsun ve bir ajanın onu çiğneyip çiğnemediğini anlayabileceği kadar somut olsun. Cümle içinde tire ve uzun çizgi kullanma.

Yalnızca tam şu biçimde tek bir JSON nesnesi döndür, başka hiçbir şey yazma:
{"kurallar":[""]}`;
}

export function skillIstemi(sirket, tarif) {
  if (sirket.dil === 'en') {
    return `You are writing an Agent Skill (a SKILL.md) for Claude Code agents.

What the user wants the skill to do: ${kisa(tarif, 3000)}

"ad" is a short lowercase name with words joined by a single hyphen, such as code-review.
"aciklama" is one or two sentences saying what the skill does and exactly when an agent should use it, because agents pick skills by this text.
"govde" is the skill body in Markdown: a short purpose line, then numbered steps the agent follows, then what a good result looks like. Keep it under 60 lines.

Return only one JSON object in exactly this shape and nothing else:
{"ad":"","aciklama":"","govde":""}`;
  }
  return `Claude Code ajanları için bir skill (SKILL.md) yazıyorsun.

Kullanıcının skilden beklediği: ${kisa(tarif, 3000)}

"ad": küçük harfli kısa bir ad, kelimeler tek tire ile birleşir, örnek: kod-inceleme.
"aciklama": skilin ne yaptığını ve ajanın onu tam olarak ne zaman kullanması gerektiğini anlatan bir ya da iki cümle. Ajanlar skili bu metne bakarak seçer.
"govde": Markdown olarak skilin gövdesi: tek satır amaç, sonra ajanın izleyeceği numaralı adımlar, sonra iyi sonucun nasıl göründüğü. 60 satırı geçmesin.

Yalnızca tam şu biçimde tek bir JSON nesnesi döndür, başka hiçbir şey yazma:
{"ad":"","aciklama":"","govde":""}`;
}

export function egitimIstemi(sirket, ajan, geriBildirim) {
  const mevcut = ajan.kurallar.map((k, i) => `${i + 1}. ${k}`).join('\n') || (sirket.dil === 'en' ? 'None.' : 'Yok.');
  if (sirket.dil === 'en') {
    return `A user is training a team member of the company "${sirket.ad}" by giving feedback. Turn the feedback into lasting rules for that person.

Team member: ${ajan.ad}, ${ajan.unvan}
Their current instructions:
${kisa(ajan.talimat, 4000)}

Their current personal rules:
${mevcut}

The feedback: ${kisa(geriBildirim, 2000)}

Write one to three rules that would have prevented the problem or that capture the preference. Each rule is one plain sentence addressed to the person ("Always ...", "Never ..."). Do not repeat a rule that already exists. No hyphens or dashes inside sentences.

Return only one JSON object in exactly this shape and nothing else:
{"kurallar":[""]}`;
  }
  return `Bir kullanıcı "${sirket.ad}" şirketindeki bir ekip üyesini geri bildirim vererek eğitiyor. Geri bildirimi o kişi için kalıcı kurallara çevir.

Ekip üyesi: ${ajan.ad}, ${ajan.unvan}
Şu anki talimatı:
${kisa(ajan.talimat, 4000)}

Şu anki kişisel kuralları:
${mevcut}

Geri bildirim: ${kisa(geriBildirim, 2000)}

Sorunu önleyecek ya da tercihi yakalayan bir ile üç kural yaz. Her kural kişiye hitap eden tek sade cümle olsun. Var olan kuralı tekrarlama. Cümle içinde tire ve uzun çizgi kullanma.

Yalnızca tam şu biçimde tek bir JSON nesnesi döndür, başka hiçbir şey yazma:
{"kurallar":[""]}`;
}

const dizi = (v, n, uzunluk) => (Array.isArray(v) ? v.map((x) => kisa(x, uzunluk)).filter(Boolean).slice(0, n) : []);

export const temizAjan = (o) => ({ ad: kisa(o.ad, 60), unvan: kisa(o.unvan, 80), alanlar: dizi(o.alanlar, 8, 40), cagri: kisa(o.cagri, 600), talimat: kisa(o.talimat, 20000), kurallar: dizi(o.kurallar, 10, 600) });
export const temizKurallar = (o) => ({ kurallar: dizi(o.kurallar, 10, 800) });
export const temizSkill = (o) => ({ ad: kisa(o.ad, 60), aciklama: kisa(o.aciklama, 1000), govde: kisa(o.govde, 30000) });
