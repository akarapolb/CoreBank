package org.fabor.engine.schedule;

import java.time.LocalDate;
import org.fabor.platform.money.Money;

public record Installment(int number, LocalDate dueDate, Money principal, Money interest, Money total,
                          Money closingBalance) { }
