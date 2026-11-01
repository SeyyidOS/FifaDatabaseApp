"""Keeps slurs and obscenities out of the names people give things others see: players, accounts,
leagues, clubs and seasons (schemas.py). App Review asks apps where people post to filter what can be
posted; photos are covered by reports and removal instead (moderation.py).

The lists are short on purpose and in Turkish and English, the app's languages. A name is lowercased
(the dotless ı read as i), digits and symbols standing in for letters are read as those letters
("s1kt1r") and a letter held for three or more ("siktiiir") counts once. Then each word of it is compared
with WORDS, and STEMS are looked for inside each word, inside letters typed apart ("f u c k") and, for a
few, across two words. A stem is only listed if no ordinary word contains it, which is why some obvious
words (the English "ass", the Turkish "sik", whose plain spelling is also "şık" typed without Turkish
letters) are missing or only matched whole.
"""

import re

NOT_ALLOWED = "that name isn't allowed"

# matched as whole words
WORDS = {
    # Turkish
    "amk",
    "aq",
    "piç",
    "puşt",
    "pust",
    "yarak",
    "oç",
    # English
    "cunt",
    "cunts",
    "fag",
    "fags",
    "nazi",
    "pussy",
    "rape",
    "rapist",
    "kys",
    "twat",
}

# matched inside words
STEMS = (
    # Turkish
    "orospu",
    "orosbu",
    "orspu",
    "siktir",
    "sikerim",
    "sikeyim",
    "sikiyim",
    "sikik",
    "sikiş",
    "sikis",
    "yarrak",
    "dalyarak",
    "amcik",
    "aminakoy",
    "aminako",
    "götveren",
    "gotveren",
    "götlek",
    "gotlek",
    "ibne",
    "pezevenk",
    "kahpe",
    "kaltak",
    "yavşak",
    "yavsak",
    "sürtük",
    "surtuk",
    "gavat",
    "kancik",
    "şerefsiz",
    "serefsiz",
    "taşak",
    "tasak",
    # English
    "fuck",
    "motherf",
    "nigger",
    "nigga",
    "faggot",
    "bitch",
    "whore",
    "slut",
    "shit",
    "asshole",
    "bastard",
    "retard",
    "porn",
    "hitler",
)

# also looked for across two neighbouring words ("oros pu"): only where no two names could run together
# into them, as "Mas Hit" holds "shit" and "Amina Koyuncu" "aminakoy"
SPLIT = ("orospu", "siktir")

# digits and symbols that stand in for letters
_LEET = str.maketrans({"0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i"})
_HELD = re.compile(r"(\w)\1{2,}")
_WORD = re.compile(r"[^\W\d_]+")


def _words(text: str) -> list[str]:
    # Turkish capitals, then the dotless ı read as i: "NIGGER" and "sIktir" are caught, while "şık" (stylish),
    # whose ş stays, isn't taken for anything (so the lists spell ı as i)
    text = text.replace("İ", "i").lower().replace("ı", "i").translate(_LEET)
    return _WORD.findall(_HELD.sub(r"\1", text))


def offensive(text: str) -> bool:
    words = _words(text)
    # letters typed apart, "f u c k" or "f.u.c.k", read together
    spaced, run = [], []
    for word in words + [""]:
        if len(word) == 1:
            run.append(word)
        else:
            if len(run) > 1:
                spaced.append("".join(run))
            run = []
    if any(word in WORDS for word in words + spaced):
        return True
    if any(stem in word for word in words + spaced for stem in STEMS):
        return True
    pairs = [a + b for a, b in zip(words, words[1:], strict=False)]
    return any(stem in pair for pair in pairs for stem in SPLIT)


def clean(name: str) -> str:
    """For a pydantic AfterValidator: the name as it is, or a ValueError."""
    if offensive(name):
        raise ValueError(NOT_ALLOWED)
    return name
