//! Port of graphql-js `jsutils/didYouMean.ts`.

const MAX_SUGGESTIONS: usize = 5;

/// Given [ A, B, C ] return ' Did you mean A, B, or C?'.
///
/// PORT: graphql-js overloads the function to take the sub-message as an
/// optional first argument.
pub fn did_you_mean(sub_message: Option<&str>, suggestions: &[&str]) -> String {
    let mut message = " Did you mean ".to_string();
    if let Some(sub_message) = sub_message {
        message += sub_message;
        message += " ";
    }

    let suggestions: Vec<String> = suggestions.iter().map(|x| format!("\"{x}\"")).collect();
    match suggestions.len() {
        0 => return String::new(),
        1 => return message + &suggestions[0] + "?",
        2 => return message + &suggestions[0] + " or " + &suggestions[1] + "?",
        _ => {}
    }

    let mut selected: Vec<String> = suggestions.into_iter().take(MAX_SUGGESTIONS).collect();
    let last_item = selected.pop().expect("Checked length above");
    message + &selected.join(", ") + ", or " + &last_item + "?"
}

#[cfg(test)]
mod tests {
    use super::did_you_mean;

    #[test]
    fn lists_suggestions() {
        assert_eq!(did_you_mean(None, &[]), "");
        assert_eq!(did_you_mean(None, &["A"]), " Did you mean \"A\"?");
        assert_eq!(
            did_you_mean(Some("the enum value"), &["A", "B"]),
            " Did you mean the enum value \"A\" or \"B\"?"
        );
        assert_eq!(
            did_you_mean(None, &["A", "B", "C", "D", "E", "F"]),
            " Did you mean \"A\", \"B\", \"C\", \"D\", or \"E\"?"
        );
    }
}
