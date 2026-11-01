//! Conservative rejection only: survivors always execute the original cent gate.
#[derive(Clone, Copy)]
pub(crate) struct RatioGate {
    lower: f64,
    upper: f64,
    valid: bool,
}
impl RatioGate {
    pub(crate) fn new(center: f64, tolerance: f64) -> Self {
        let lower = 2.0_f64
            .powf((center - (tolerance + 0.5)) / 1200.0)
            .next_down();
        let upper = 2.0_f64
            .powf((center + (tolerance + 0.5)) / 1200.0)
            .next_up();
        Self {
            lower,
            upper,
            valid: center.is_finite()
                && center.abs() <= 128.0
                && tolerance.is_finite()
                && (0.0..=45.0).contains(&tolerance)
                && lower.is_normal()
                && upper.is_normal(),
        }
    }
    #[inline]
    pub(crate) fn rejects(self, numerator: f64, denominator: f64) -> bool {
        let quotient = numerator / denominator;
        // Padding dwarfs the pinned libm error (see implementation report).
        // Exceptional operands/quotients retain the original NaN/inf semantics.
        self.valid
            && numerator > 0.0
            && numerator.is_normal()
            && denominator > 0.0
            && denominator.is_normal()
            && quotient > 0.0
            && quotient.is_normal()
            && (quotient < self.lower || quotient > self.upper)
    }
}
