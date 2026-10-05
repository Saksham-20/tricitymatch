import { launchDateLabel } from '../utils/launchDate';

/**
 * Ready-to-send messages for marketing partners (Outreach Kit).
 *
 * Kept out of the page so the wording can be reviewed and tested in one place.
 * Every claim in here has to be true on the website today: there is no member
 * count, no success claim and no promise about matches, and verification is
 * described as exactly what it is (a live selfie check).
 *
 * @param {{ me: string, link: string, phase: 'before'|'today'|'after' }} o  (`phase` from utils/launchDate)
 * @returns {{ id: string, title: string, note?: string, text: string }[]}
 */
export function messageTemplates({ me, link, phase = 'after' }) {
  const list = [
    {
      id: 'intro',
      title: 'First message',
      note: 'For someone you know.',
      text:
`Hi [Name], it's ${me}. I'm a partner with TricityMatch, a matrimonial site made only for Chandigarh, Mohali and Panchkula. Creating a profile is free, members can verify themselves with a live selfie, and each person decides who can see their phone number.

If it could be useful for you or someone in your family, you can start here: ${link}

Happy to answer any questions.`,
    },
    {
      id: 'parent',
      title: 'For a parent',
      note: 'A profile can be created on behalf of a son or daughter.',
      text:
`Namaste [Name] ji, it's ${me}. If you are looking for a suitable match for your son or daughter, there is a matrimonial site made only for families in Chandigarh, Mohali and Panchkula, called TricityMatch. A profile is free to create, and you can create it on their behalf.

You can start here: ${link}

I would be glad to help you set it up if you would like.`,
    },
    {
      id: 'hindi',
      title: 'First message in Hindi',
      note: 'Same message, for Hindi speakers.',
      text:
`नमस्ते [Name] जी, मैं ${me} हूँ। मैं TricityMatch का पार्टनर हूँ। यह चंडीगढ़, मोहाली और पंचकूला के परिवारों के लिए बनी विवाह-संबंधी वेबसाइट है। प्रोफ़ाइल बनाना मुफ़्त है, सदस्य लाइव सेल्फ़ी से अपनी प्रोफ़ाइल सत्यापित कर सकते हैं, और हर व्यक्ति तय करता है कि उसका फ़ोन नंबर कौन देख सकता है।

अगर यह आपके या आपके परिवार के किसी सदस्य के काम आ सके, तो यहाँ से शुरू करें: ${link}

कोई भी सवाल हो तो मैं मदद के लिए तैयार हूँ।`,
    },
    {
      id: 'followup',
      title: 'Follow-up after a few days',
      note: 'One gentle reminder is enough. Do not send a third.',
      text:
`Hi [Name], a quick note to check whether you had a chance to look at the TricityMatch link I sent. No hurry at all. If you have any questions, I am happy to help: ${link}`,
    },
  ];

  // Only while the launch is still ahead of us (or today); afterwards it would
  // announce something that already happened.
  if (phase !== 'after') {
    const when = phase === 'today' ? 'launches today' : `launches on ${launchDateLabel()}`;
    list.push({
      id: 'launch',
      title: 'Launch announcement',
      note: phase === 'today' ? 'For launch day.' : `For the run-up to ${launchDateLabel()}.`,
      text:
`Hi [Name], TricityMatch ${when} for families across Chandigarh, Mohali and Panchkula. If you or someone you know is looking for a match, you can create a free profile here: ${link}`,
    });
  }

  return list;
}
