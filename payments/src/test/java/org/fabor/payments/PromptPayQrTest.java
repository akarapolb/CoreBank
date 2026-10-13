package org.fabor.payments;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import org.fabor.payments.PromptPayQr.ProxyType;
import org.junit.jupiter.api.Test;

class PromptPayQrTest {
    @Test
    void crcMatchesTheStandardCheckValue() {
        assertThat(PromptPayQr.crc16("123456789")).isEqualTo(0x29B1); // CRC-16/CCITT-FALSE reference vector
    }

    @Test
    void mobileStaticQrRoundTrips() {
        String qr = PromptPayQr.generate(ProxyType.MOBILE, "081-234-5678", null);
        assertThat(qr).startsWith("00020101021129370016A000000677010111011300668123456785303764")
                .contains("5802TH6304").hasSize(qr.indexOf("6304") + 8);
        var p = PromptPayQr.parse(qr);
        assertThat(p.proxyType()).isEqualTo(ProxyType.MOBILE);
        assertThat(p.proxy()).isEqualTo("0812345678");
        assertThat(p.dynamic()).isFalse();
    }

    @Test
    void dynamicQrCarriesTheAmount() {
        String qr = PromptPayQr.generate(ProxyType.MOBILE, "0812345678", new BigDecimal("1234.5"));
        assertThat(qr).contains("010212").contains("54071234.50");
        var p = PromptPayQr.parse(qr);
        assertThat(p.amount()).isEqualByComparingTo("1234.50");
        assertThat(p.dynamic()).isTrue();
    }

    @Test
    void nationalIdAndEwalletProxies() {
        String id = "1101700230678"; // passes the Thai id checksum
        var p = PromptPayQr.parse(PromptPayQr.generate(ProxyType.NATIONAL_ID, id, null));
        assertThat(p.proxyType()).isEqualTo(ProxyType.NATIONAL_ID);
        assertThat(p.proxy()).isEqualTo(id);
        var w = PromptPayQr.parse(PromptPayQr.generate(ProxyType.EWALLET, "123456789012345", new BigDecimal("10")));
        assertThat(w.proxyType()).isEqualTo(ProxyType.EWALLET);
        assertThat(w.proxy()).isEqualTo("123456789012345");
    }

    @Test
    void generationValidatesInputs() {
        assertThatThrownBy(() -> PromptPayQr.generate(ProxyType.MOBILE, "12345", null)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> PromptPayQr.generate(ProxyType.NATIONAL_ID, "1101700230673", null)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> PromptPayQr.generate(ProxyType.NATIONAL_ID, "123", null)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> PromptPayQr.generate(ProxyType.EWALLET, "123", null)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> PromptPayQr.generate(ProxyType.MOBILE, "0812345678", BigDecimal.ZERO)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> PromptPayQr.generate(ProxyType.MOBILE, "0812345678", new BigDecimal("1.005"))).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void parsingRejectsDamagedOrForeignPayloads() {
        String qr = PromptPayQr.generate(ProxyType.MOBILE, "0812345678", new BigDecimal("50"));
        String flipped = qr.replace("5802TH", "5802TX");
        assertThatThrownBy(() -> PromptPayQr.parse(flipped)).hasMessageContaining("CRC");
        assertThatThrownBy(() -> PromptPayQr.parse("hello")).hasMessageContaining("CRC");
        assertThatThrownBy(() -> PromptPayQr.parse(qr.substring(0, qr.length() - 1) + "Z")).hasMessageContaining("CRC");
        assertThatThrownBy(() -> PromptPayQr.parse(withCrc("000201010211" + "5303764" + "5802TH"))).hasMessageContaining("account");
        assertThatThrownBy(() -> PromptPayQr.parse(withCrc("000202" + "5303764" + "5802TH"))).hasMessageContaining("format");
        assertThatThrownBy(() -> PromptPayQr.parse(withCrc("000201" + "5303840" + "5802TH"))).hasMessageContaining("baht");
        assertThatThrownBy(() -> PromptPayQr.parse(withCrc("000201" + "2912" + "0008OTHERAID" + "5303764" + "5802TH"))).hasMessageContaining("PromptPay");
        assertThatThrownBy(() -> PromptPayQr.parse(withCrc("000201" + "29" + "20" + "0016A000000677010111" + "5303764" + "5802TH")))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> PromptPayQr.parse(withCrc("0002010" ))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> PromptPayQr.parse(withCrc("0002XX"))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> PromptPayQr.parse(withCrc("000299"))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> PromptPayQr.parse(withCrc("000201" + "29" + "20" + "0016A000000677010111" + "01" + "10" + "0066812345" + "5303764" + "5802TH")))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void badMobileProxyInsideAValidCrcIsRejected() {
        String body = "000201" + "29" + "37" + "0016A000000677010111" + "0113" + "0044812345678" + "5303764" + "5802TH";
        assertThatThrownBy(() -> PromptPayQr.parse(withCrc(body))).hasMessageContaining("mobile");
        String noProxy = "000201" + "29" + "20" + "0016A000000677010111" + "5303764" + "5802TH";
        assertThatThrownBy(() -> PromptPayQr.parse(withCrc(noProxy))).hasMessageContaining("proxy");
    }

    private static String withCrc(String body) {
        String b = body + "6304";
        return b + String.format("%04X", PromptPayQr.crc16(b));
    }
}
