use oxc_allocator::ArenaVec;
use oxc_ast::ast::*;
use oxc_span::SPAN;

use crate::codegen::ts_ast_builder::TsAstBuilder;

pub const ASSERT_NON_NULL_HELPER: &str = "assertNonNull";

/// ```ts
/// async function assertNonNull<T>(value: T | Promise<T>): Promise<T> {
///   const awaited = await value;
///   if (awaited == null)
///     throw new Error("Cannot return null for semantically non-nullable field.");
///   return awaited;
/// }
/// ```
pub fn create_assert_non_null_helper<'a>(ts: &TsAstBuilder<'a>) -> Statement<'a> {
    let arg_name = "value";
    let awaited = "awaited";
    let t = "T";
    let t_reference = || ts.type_reference(t, vec![]);
    let promise_t = || ts.type_reference("Promise", vec![t_reference()]);

    let type_param = TSType::new_ts_union_type(
        SPAN,
        ArenaVec::from_array_in([t_reference(), promise_t()], ts),
        ts,
    );

    Statement::from(ts.function(
        ASSERT_NON_NULL_HELPER,
        true,
        Some(vec![t]),
        vec![ts.param(arg_name, Some(type_param))],
        Some(promise_t()),
        ts.block(vec![
            ts.variable_statement(
                VariableDeclarationKind::Const,
                awaited,
                None,
                Expression::new_await_expression(SPAN, ts.identifier(arg_name), ts),
            ),
            Statement::new_if_statement(
                SPAN,
                Expression::new_binary_expression(
                    SPAN,
                    ts.identifier(awaited),
                    BinaryOperator::Equality,
                    Expression::new_null_literal(SPAN, ts),
                    ts,
                ),
                Statement::new_throw_statement(
                    SPAN,
                    ts.new_expression(
                        ts.identifier("Error"),
                        vec![ts.string_literal(
                            "Cannot return null for semantically non-nullable field.",
                        )],
                    ),
                    ts,
                ),
                None,
                ts,
            ),
            ts.return_statement(ts.identifier(awaited)),
        ]),
    ))
}
