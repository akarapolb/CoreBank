package org.fabor.payments;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Thai QR payment (PromptPay) in the EMVCo merchant-presented format. Generates and parses the TLV payload,
 * including the CRC-16/CCITT-FALSE check. Proxy types: mobile number, 13-digit national or tax id, e-wallet id.
 */
public final class PromptPayQr {
    public enum ProxyType { MOBILE, NATIONAL_ID, EWALLET }

    public record Payload(ProxyType proxyType, String proxy, BigDecimal amount) {
        public boolean dynamic() {
            return amount != null;
        }
    }

    private static final String AID = "A000000677010111";

    private PromptPayQr() { }

    /** @param amount null for a static QR the payer fills in, or an amount in baht with at most 2 decimals */
    public static String generate(ProxyType type, String proxy, BigDecimal amount) {
        String normalised = normalise(type, proxy);
        if (amount != null && (amount.signum() <= 0 || amount.scale() > 2 || amount.compareTo(new BigDecimal("9999999999.99")) > 0)) {
            throw new IllegalArgumentException("Amount must be positive with at most 2 decimals");
        }
        StringBuilder sb = new StringBuilder();
        sb.append(tlv("00", "01"));
        sb.append(tlv("01", amount == null ? "11" : "12"));
        sb.append(tlv("29", tlv("00", AID) + tlv(subTag(type), normalised)));
        sb.append(tlv("53", "764"));
        if (amount != null) {
            sb.append(tlv("54", amount.setScale(2).toPlainString()));
        }
        sb.append(tlv("58", "TH"));
        sb.append("6304");
        return sb + String.format("%04X", crc16(sb.toString()));
    }

    /** @throws IllegalArgumentException if the payload is malformed, fails the CRC or is not a PromptPay QR */
    public static Payload parse(String payload) {
        if (payload.length() < 8 || !payload.regionMatches(payload.length() - 8, "6304", 0, 4)) {
            throw new IllegalArgumentException("Missing CRC field");
        }
        String body = payload.substring(0, payload.length() - 4);
        String crc = payload.substring(payload.length() - 4);
        if (!String.format("%04X", crc16(body)).equalsIgnoreCase(crc)) {
            throw new IllegalArgumentException("CRC mismatch");
        }
        Map<String, String> top = tlvMap(payload.substring(0, payload.length() - 8));
        if (!"01".equals(top.get("00"))) {
            throw new IllegalArgumentException("Unsupported payload format");
        }
        if (!"764".equals(top.get("53")) || !"TH".equals(top.get("58"))) {
            throw new IllegalArgumentException("Not a Thai baht QR");
        }
        String account = top.get("29");
        if (account == null) {
            throw new IllegalArgumentException("No PromptPay account block");
        }
        Map<String, String> acct = tlvMap(account);
        if (!AID.equals(acct.get("00"))) {
            throw new IllegalArgumentException("Not a PromptPay account block");
        }
        ProxyType type;
        String proxy;
        if (acct.containsKey("01")) {
            type = ProxyType.MOBILE;
            proxy = acct.get("01");
            if (!proxy.startsWith("0066") || proxy.length() != 13) {
                throw new IllegalArgumentException("Bad mobile proxy");
            }
            proxy = "0" + proxy.substring(4);
        } else if (acct.containsKey("02")) {
            type = ProxyType.NATIONAL_ID;
            proxy = acct.get("02");
        } else if (acct.containsKey("03")) {
            type = ProxyType.EWALLET;
            proxy = acct.get("03");
        } else {
            throw new IllegalArgumentException("No proxy in PromptPay account block");
        }
        BigDecimal amount = top.containsKey("54") ? new BigDecimal(top.get("54")) : null;
        return new Payload(type, proxy, amount);
    }

    private static String normalise(ProxyType type, String proxy) {
        String digits = proxy.replaceAll("[\\s-]", "");
        switch (type) {
            case MOBILE -> {
                if (!digits.matches("0[689]\\d{8}")) {
                    throw new IllegalArgumentException("Thai mobile number expected, e.g. 0812345678");
                }
                return "0066" + digits.substring(1);
            }
            case NATIONAL_ID -> {
                if (!digits.matches("\\d{13}") || !validNationalIdChecksum(digits)) {
                    throw new IllegalArgumentException("Valid 13-digit national or tax id expected");
                }
                return digits;
            }
            default -> {
                if (!digits.matches("\\d{15}")) {
                    throw new IllegalArgumentException("15-digit e-wallet id expected");
                }
                return digits;
            }
        }
    }

    /** Thai 13-digit id checksum: (11 - sum(d_i * (13 - i)) mod 11) mod 10 equals the last digit. */
    static boolean validNationalIdChecksum(String id) {
        int sum = 0;
        for (int i = 0; i < 12; i++) {
            sum += (id.charAt(i) - '0') * (13 - i);
        }
        return (11 - sum % 11) % 10 == id.charAt(12) - '0';
    }

    private static String subTag(ProxyType t) {
        return switch (t) {
            case MOBILE -> "01";
            case NATIONAL_ID -> "02";
            case EWALLET -> "03";
        };
    }

    private static String tlv(String tag, String value) {
        return tag + String.format("%02d", value.length()) + value;
    }

    private static Map<String, String> tlvMap(String s) {
        Map<String, String> out = new LinkedHashMap<>();
        int i = 0;
        while (i < s.length()) {
            if (i + 4 > s.length()) {
                throw new IllegalArgumentException("Truncated TLV");
            }
            String tag = s.substring(i, i + 2);
            int len;
            try {
                len = Integer.parseInt(s.substring(i + 2, i + 4));
            } catch (NumberFormatException e) {
                throw new IllegalArgumentException("Bad TLV length", e);
            }
            if (i + 4 + len > s.length()) {
                throw new IllegalArgumentException("Truncated TLV value");
            }
            out.put(tag, s.substring(i + 4, i + 4 + len));
            i += 4 + len;
        }
        return out;
    }

    /** CRC-16/CCITT-FALSE: polynomial 0x1021, initial value 0xFFFF, no reflection, no final xor. */
    static int crc16(String s) {
        int crc = 0xFFFF;
        for (byte b : s.getBytes(StandardCharsets.UTF_8)) {
            crc ^= (b & 0xFF) << 8;
            for (int k = 0; k < 8; k++) {
                crc = (crc & 0x8000) != 0 ? (crc << 1) ^ 0x1021 : crc << 1;
                crc &= 0xFFFF;
            }
        }
        return crc;
    }
}
