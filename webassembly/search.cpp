#include <stdint.h>

namespace {

constexpr uint64_t kMultiplier = 0x5d588b656c078965ULL;
constexpr uint64_t kIncrement = 0x269ec3ULL;
constexpr uint32_t kResultCapacity = 100000;

struct Result {
    uint32_t seed;
    uint32_t start_frame;
    uint32_t end_frame;
};

Result results[kResultCapacity];

inline uint64_t next(uint64_t seed) {
    return seed * kMultiplier + kIncrement;
}

uint64_t advance(uint64_t seed, uint64_t count) {
    uint64_t multiplier = kMultiplier;
    uint64_t increment = kIncrement;
    uint64_t accumulated_multiplier = 1;
    uint64_t accumulated_increment = 0;

    while (count != 0) {
        if ((count & 1U) != 0) {
            accumulated_multiplier *= multiplier;
            accumulated_increment = accumulated_increment * multiplier + increment;
        }
        increment *= multiplier + 1;
        multiplier *= multiplier;
        count >>= 1U;
    }
    return accumulated_multiplier * seed + accumulated_increment;
}

inline uint32_t observed_bit(uint64_t seed) {
    // getPercent(position, 100): discard the fractional part, then test parity.
    return static_cast<uint32_t>(((seed >> 32U) * 100ULL) >> 32U) & 1U;
}

inline bool add_result(uint32_t &count, uint32_t limit, uint32_t seed,
                       uint32_t start_frame, uint32_t end_frame) {
    if (count >= limit) {
        return false;
    }
    results[count++] = {seed, start_frame, end_frame};
    return count < limit;
}

} // namespace

extern "C" {

__attribute__((used)) uintptr_t result_buffer() {
    return reinterpret_cast<uintptr_t>(results);
}

__attribute__((used)) uint32_t search_range(
    uint32_t seed_start,
    uint32_t seed_end,
    uint32_t max_frame,
    uint32_t pattern_low,
    uint32_t pattern_high,
    uint32_t pattern_length,
    uint32_t start_filter,
    uint32_t end_filter,
    uint32_t filter_flags,
    uint32_t result_limit) {
    if (seed_start > seed_end || result_limit == 0) {
        return 0;
    }
    if (result_limit > kResultCapacity) {
        result_limit = kResultCapacity;
    }

    const uint64_t pattern = static_cast<uint64_t>(pattern_low) |
                             (static_cast<uint64_t>(pattern_high) << 32U);
    const uint64_t mask = pattern_length == 0
        ? 0
        : (pattern_length == 64 ? UINT64_MAX : ((1ULL << pattern_length) - 1ULL));
    uint32_t count = 0;

    for (uint32_t initial = seed_start;; ++initial) {
        const bool has_end_filter = (filter_flags & 2U) != 0;
        const bool has_start_filter = (filter_flags & 1U) != 0 && !has_end_filter;
        uint64_t target_frame_wide = end_filter;
        if (has_start_filter) {
            target_frame_wide = pattern_length == 0
                ? (start_filter == 0 ? UINT64_MAX : static_cast<uint64_t>(start_filter) - 1U)
                : static_cast<uint64_t>(start_filter) + pattern_length - 1U;
        }

        if (has_start_filter || has_end_filter) {
            if (target_frame_wide <= UINT32_MAX) {
                const uint32_t target_frame = static_cast<uint32_t>(target_frame_wide);
                const uint32_t start_frame = target_frame - pattern_length + 1U;
                if (target_frame < max_frame &&
                    (pattern_length == 0 || static_cast<uint64_t>(target_frame) + 1U >= pattern_length)) {
                    bool matches = true;
                    if (pattern_length != 0) {
                        uint64_t observed_seed = advance(initial, static_cast<uint64_t>(start_frame) + 1U);
                        uint64_t window = 0;
                        for (uint32_t index = 0; index < pattern_length; ++index) {
                            window = ((window << 1U) | observed_bit(observed_seed)) & mask;
                            observed_seed = next(observed_seed);
                        }
                        matches = window == pattern;
                    }
                    if (matches && !add_result(count, result_limit, initial, start_frame, target_frame)) {
                        return count;
                    }
                }
            }
        } else {
            uint64_t observed_seed = next(initial);
            uint64_t window = 0;
            for (uint32_t frame = 0;; ++frame) {
                window = ((window << 1U) | observed_bit(observed_seed)) & mask;
                observed_seed = next(observed_seed);
                if ((pattern_length == 0 || static_cast<uint64_t>(frame) + 1U >= pattern_length) &&
                    (pattern_length == 0 || window == pattern)) {
                    const uint32_t start_frame = frame - pattern_length + 1U;
                    if (!add_result(count, result_limit, initial, start_frame, frame)) {
                        return count;
                    }
                }
                if (static_cast<uint64_t>(frame) + 1U >= max_frame) {
                    break;
                }
            }
        }

        if (initial == seed_end || count >= result_limit) {
            break;
        }
    }
    return count;
}

}
