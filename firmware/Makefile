# TOON helpers for firmware workflows
#
# Usage examples:
#   make toon-stats INPUT=data/sample.json OUT=tools/toon/output.toon
#   make toon-encode INPUT=data/sample.json OUT=tools/toon/output.toon DELIM='\t' LEN=1
#   make toon-decode INPUT=tools/toon/output.toon OUT=tools/toon/output.json STRICT=0

# User-configurable variables (can be overridden on the command line)
INPUT ?= data/sample.json
DELIM ?= ,
LEN ?= 1            # 1 enables --length-marker
STRICT ?= 1         # 1 strict decode; 0 adds --no-strict
OUT ?=

# Internal defaults for outputs when OUT is not provided
DEFAULT_TOON_OUT := tools/toon/output.toon
DEFAULT_JSON_OUT := tools/toon/output.json

# Convenience function to map LEN/STRICT to flags
LEN_FLAG   = $(if $(filter 1 true yes on,$(LEN)),--length-marker,)
STRICT_NEG = $(if $(filter 0 false no off,$(STRICT)),--no-strict,)

.PHONY: toon-help toon-stats toon-encode toon-decode

toon-help:
	@echo "TOON targets:"
	@echo "  make toon-stats  INPUT=<in.json> [OUT=<out.toon>] [DELIM=,|\t|\|] [LEN=1|0]"
	@echo "  make toon-encode INPUT=<in.json> [OUT=<out.toon>] [DELIM=,|\t|\|] [LEN=1|0]"
	@echo "  make toon-decode INPUT=<in.toon> [OUT=<out.json>] [STRICT=1|0]"

# Encode JSON -> TOON with token stats
toon-stats:
	@tools/toon/toon.sh "$(INPUT)" \
	  --delimiter "$(DELIM)" $(LEN_FLAG) --stats \
	  -o "$(if $(OUT),$(OUT),$(DEFAULT_TOON_OUT))"

# Encode JSON -> TOON
toon-encode:
	@tools/toon/toon.sh "$(INPUT)" \
	  --delimiter "$(DELIM)" $(LEN_FLAG) \
	  -o "$(if $(OUT),$(OUT),$(DEFAULT_TOON_OUT))"

# Decode TOON -> JSON
toon-decode:
	@tools/toon/toon.sh "$(INPUT)" --decode $(STRICT_NEG) \
	  -o "$(if $(OUT),$(OUT),$(DEFAULT_JSON_OUT))"

# Validate roundtrip for sample JSONs
toon-validate:
	@tools/toon/roundtrip_validate.sh data/toon-samples --delimiter "\t" --length-marker


# Run baselines over sample JSONs and summarize
toon-baseline-samples:
	@tools/toon/baseline_stats.sh data/toon-samples --delimiter "\t" --length-marker
	@tools/toon/summarize_baselines.sh tools/toon/baselines

