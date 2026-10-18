"""Chelo's feedback (three bullets) at the foot of the season report, written by OpenAI from the engine's facts.

The report itself (marks, tides, coin, investments, the Modern Mirror) is worked out by the engine
and written by hand in content/. The model only writes this one short note, and it gets checked:
three short bullets, no invented numbers, none of the phrases that make text read as machine-written, a sane length.
Anything that fails twice, or any API trouble, falls back to Chelo's hand-written question.
"""
import json
import os
import re
import httpx

URL = 'https://api.openai.com/v1/chat/completions'
DEFAULT_MODEL = 'gpt-4.1-mini'

SYSTEM = """You are Chelo, a sea turtle who has watched the tides of Atlantis for three hundred years. \
You write the feedback at the bottom of a player's season report in a game about money. \
The report above already lists every number and grade, so don't recite them. \
Say what mattered, the way a sharp, warm old friend would: plainly, a little dry, never preachy.

Write exactly three bullet points, each on its own line starting with "- ":
1. The choice that helped most this season, and why it worked.
2. The choice that cost the most, and what it cost. If nothing went wrong, the biggest risk ahead.
3. One short question for the player to think about.

Rules:
- Each bullet is one sentence of at most 16 words.
- Use only the facts given. Any number you write must appear in the facts exactly. Never invent events.
- Speak to the player as "you". Plain words a twelve-year-old would follow.
- Use the game's words: coin (◈), Purse, Vault, Leviathan card, Standing, tides, kelp, Passage, Grin, \
the Exchange and the houses by name. No real-world finance terms.
- Be honest. If something went badly, say so without scolding. No cheerleading.
- Don't tell the player what to do next.
- Never use em dashes, en dashes, semicolons, exclamation marks, emojis, headings, a greeting, a sign-off, \
or letter grades.
- Never use these words or phrases: journey, navigate, delve, tapestry, testament, crucial, vital, \
embark, realm, landscape, unlock, empower, leverage, robust, seamless, thrive, "it's important", \
"remember", "keep in mind", "great job", "well done", "not only", "in conclusion", "overall".

Example, for a different player:
- Five shifts brought in 300◈, the most coin you've held all year.
- Then 200◈ went into Deepcoral, and that voyage sank with it.
- How much of next season's pay is already spoken for?"""

BANNED = re.compile(
    r'—|–|;|!|journey|navigat|delve|tapestry|testament|crucial|vital|embark|realm|landscape|unlock|'
    r'empower|leverag|robust|seamless|thriv|it\'s important|remember|keep in mind|great job|well done|'
    r'not only|in conclusion|overall|\bgrade\b|\b[ABCD]\b(?= grade)',
    re.IGNORECASE,
)
NUMBER = re.compile(r'\d+(?:\.\d+)?')
BULLET_WORDS = (3, 18)


def brief(report: dict) -> dict:
    """The facts the model sees: what the report shows, without the raw engine dump."""
    f = report['facts']
    return {
        'season': report['season'],
        'starting_place': report['class_id'],
        'marks': [{'subject': m['label'], 'verdict': m['text'], 'good': m['grade'] in 'AB'} for m in report['marks']],
        'tides': {'total': report['tides']['total'], **{u['label']: u['count'] for u in report['tides']['uses']}},
        'coin_in': {r['label']: r['amount'] for r in report['money']['in']},
        'coin_out': {r['label']: r['amount'] for r in report['money']['out']},
        'moved_to_vault': report['money']['saved'],
        'debt_paid': report['money']['debt_paid'],
        'investments': [
            {'house': r['name'], 'shares': r['shares'], 'worth': r['value'], 'paid': r['paid'],
             'gain_this_season': r['season_gain'], 'voyage_succeeded': r['voyage']}
            for r in report['investments']['rows']
        ],
        'worth_start': f['pace']['net_worth_start'],
        'worth_end': f['pace']['net_worth_end'],
        'passage_next_season': f['pace']['passage_next'],
        'purse_end': f['end']['purse'],
        'vault_end': f['end']['vault'],
        'events': f['events'],
        'market_news': f['shock'],
        'kelp_in_cellar': f['food']['stored'],
        'went_hungry': f['food']['hungry'],
        'standing': f['standing'],
        'tavern': f['gambling'],
    }


def check(text: str, facts: dict) -> list[str] | None:
    """The bullets, tidied, or None if any breaks a rule."""
    bullets = [line.strip().lstrip('-•*').strip() for line in text.strip().splitlines() if line.strip()]
    if not 2 <= len(bullets) <= 3:
        return None
    known = set(NUMBER.findall(json.dumps(facts)))
    for b in bullets:
        if not BULLET_WORDS[0] <= len(b.split()) <= BULLET_WORDS[1] or BANNED.search(b):
            return None
        if any(n not in known for n in NUMBER.findall(b)):
            return None  # a number the engine never said
    return bullets


def note(report: dict, client=None) -> dict:
    fallback = {'bullets': report['chelo'], 'source': 'template'}
    key = os.getenv('OPENAI_API_KEY')
    model = os.getenv('OPENAI_MODEL') or DEFAULT_MODEL
    if not key or not re.fullmatch(r'[A-Za-z0-9._-]+', model):
        return fallback
    facts = brief(report)
    body = {
        'model': model,
        'messages': [{'role': 'system', 'content': SYSTEM},
                     {'role': 'user', 'content': json.dumps(facts, ensure_ascii=False)}],
    }
    if model.startswith(('gpt-5', 'o')):  # reasoning models: no temperature, a small thinking budget
        body |= {'max_completion_tokens': 1200, 'reasoning_effort': 'low'}
    else:
        body |= {'max_tokens': 160, 'temperature': 0.8}
    owned = client is None
    client = client or httpx.Client(timeout=12)
    try:
        for _ in range(2):
            response = client.post(URL, headers={'Authorization': f'Bearer {key}'}, json=body)
            response.raise_for_status()
            bullets = check(response.json()['choices'][0]['message']['content'] or '', facts)
            if bullets:
                return {'bullets': bullets, 'source': 'openai'}
        return fallback
    except (httpx.HTTPError, ValueError, KeyError, IndexError, TypeError):
        return fallback
    finally:
        if owned:
            client.close()
