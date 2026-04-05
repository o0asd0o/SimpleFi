package model

import (
	"crypto/rand"
	"math/big"
	"strings"
)

// wordList contains 256 common English words for passphrase generation.
// 6 words from 256 = 48 bits of entropy, sufficient for recovery passphrases.
var wordList = [256]string{
	"abandon", "about", "above", "across", "action", "active", "actual", "after",
	"again", "agree", "air", "almost", "along", "also", "always", "among",
	"anchor", "angel", "animal", "answer", "apple", "area", "army", "arrow",
	"artist", "autumn", "average", "avocado", "aware", "bamboo", "banana", "banner",
	"base", "basket", "battle", "beach", "beauty", "begin", "below", "bench",
	"between", "bird", "blanket", "blind", "blood", "blossom", "board", "body",
	"bone", "bonus", "book", "border", "bottom", "brave", "bread", "breeze",
	"brick", "bridge", "bright", "bring", "broken", "brother", "brush", "bubble",
	"buddy", "budget", "butter", "cabin", "cable", "cake", "camera", "camp",
	"candle", "candy", "canvas", "captain", "carbon", "cargo", "carpet", "castle",
	"catalog", "catch", "cattle", "caught", "caution", "ceiling", "celery", "cement",
	"chair", "chalk", "change", "chapter", "cheese", "cherry", "chicken", "chief",
	"child", "circle", "citizen", "city", "civil", "clean", "clever", "climb",
	"clock", "cloud", "clown", "cluster", "coach", "coconut", "coffee", "coin",
	"collect", "color", "column", "combine", "comfort", "common", "company", "concert",
	"conduct", "connect", "consider", "control", "coral", "corner", "cotton", "country",
	"couple", "cover", "craft", "cream", "cricket", "cross", "crowd", "crystal",
	"current", "curtain", "custom", "cycle", "dance", "danger", "daughter", "dawn",
	"debate", "decade", "december", "decide", "deep", "define", "delay", "deliver",
	"demand", "depend", "deposit", "depth", "desert", "design", "detail", "detect",
	"device", "diamond", "digital", "dinner", "direct", "discover", "display", "distance",
	"doctor", "dolphin", "domain", "donkey", "double", "dragon", "drama", "dream",
	"dress", "drift", "drink", "drum", "eagle", "early", "earth", "editor",
	"effort", "eight", "elder", "element", "elephant", "embrace", "emerge", "emotion",
	"enable", "ending", "endless", "energy", "engine", "enjoy", "enough", "enter",
	"envelope", "episode", "equal", "erosion", "estate", "eternal", "evening", "event",
	"evidence", "evil", "evolve", "example", "excess", "exhaust", "exotic", "expand",
	"fabric", "faculty", "faith", "family", "famous", "fancy", "fantasy", "fashion",
	"father", "favorite", "fiction", "figure", "filter", "final", "finger", "finish",
	"fire", "first", "flight", "floor", "flower", "fluid", "fly", "foam",
	"focus", "follow", "forest", "fortune", "fossil", "found", "frame", "fresh",
	"friend", "frozen", "fruit", "future", "galaxy", "garden", "garlic", "gentle",
}

// GeneratePassphrase picks 6 random words from the word list.
func GeneratePassphrase() (string, error) {
	words := make([]string, 6)
	for i := range words {
		idx, err := rand.Int(rand.Reader, big.NewInt(int64(len(wordList))))
		if err != nil {
			return "", err
		}
		words[i] = wordList[idx.Int64()]
	}
	return strings.Join(words, " "), nil
}
