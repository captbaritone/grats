#!/bin/bash

# List of files that need .invalid added
files=(
"derived_context/derivedContextChain.ts"
"directives/defineCustomDirectiveOnIsNotString.ts"
"enums/ExplicitlyNumericEnum.ts"
"enums/ImplicitlyNumericEnum.ts"
"field_definitions/FieldAsStaticClassMethodOnNonDefaultExportUnnamedNonGqlClass.ts"
"field_definitions/FieldDefinedOnNonGqlType.ts"
"field_definitions/FieldOnArbitraryParam.ts"
"field_definitions/FieldTagOnIncorrectNode.ts"
"field_definitions/FiledWithUnionOfMultipleTypes.ts"
"field_definitions/ReferenceNonGraphQLType.ts"
"field_definitions/ReferenceUndefinedType.ts"
"field_values/DuplicateFields.ts"
"generics/missingGqlGenericTypeArg.ts"
"generics/passOuptutTypeToInputType.input.ts"
"generics/scalarPassedAsGenericArg.ts"
"generics/todo/genericInterfaceFromTypeParam.ts"
"generics/todo/genericTypeImplementsInterface.ts"
"generics/undefinedTypeUsedAsGenericTypeArg.ts"
"input_type_one_of/oneOfUnionMemberNotLiteral.ts"
"input_types/InputTypeInterfaceFunction.ts"
"interfaces/MergedInterfaces.ts"
"locate/genericType.ts"
"locate/genericTypeField.ts"
"locate/inputType.ts"
"locate/inputTypeField.ts"
"locate/interface.ts"
"locate/type.ts"
"locate/typeField.ts"
"resolver_context/ContextValueTypeNotDefined.ts"
"top_level_fields/queryFieldOnMethod.ts"
"typename/ImplementorMissingTypename.ts"
"typename/MethodTypename.ts"
"typename/PropertySignatureTypenameIncorrectName.ts"
"typename/PropertySignatureTypenameMissingType.ts"
"typename/PropertySignatureTypenameNonLiteralType.ts"
"typename/PropertyTypenameDoesNotMatchClassName.ts"
"typename/PropertyTypenameDoesNotMatchDeclaredName.ts"
"typename/PropertyTypenameMustNeedToBeDeclaredAsConst.ts"
"typename/PropertyTypenameMustNeedToBeDeclaredAsExactlyConst.ts"
"typename/PropertyTypenameNoInitializer.ts"
"typename/PropertyTypenameNonStringInitializer.ts"
"typename/UnionMemberMissingTypename.ts"
"user_error/GqlTagDoesNotExist.ts"
"user_error/WrongCaseGqlTag.ts"
)

# Special cases that have issues with their current names
special_cases=(
"interfaces/InterfaceMergedIntoObject.invalid.ts:interfaces/InterfaceMergedIntoObject.ts"
"todo/RedefineBuiltinScalar.invalid.ts:todo/RedefineBuiltinScalar.ts"
"type_definitions_from_interface/QueryFromInterface.invlaid.ts:type_definitions_from_interface/QueryFromInterface.invalid.ts"
)

cd src/tests/fixtures

# Handle special cases first
for case in "${special_cases[@]}"; do
    from="${case%%:*}"
    to="${case##*:}"
    if [ -f "$from" ]; then
        echo "Special case: $from -> $to"
        mv "$from" "$to"
        if [ -f "$from.expected" ]; then
            mv "$from.expected" "$to.expected"
        fi
    fi
done

# Rename regular files
for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        new_name="${file%.ts}.invalid.ts"
        echo "Renaming: $file -> $new_name"
        mv "$file" "$new_name"
        
        # Also rename expected file if it exists
        if [ -f "$file.expected" ]; then
            mv "$file.expected" "$new_name.expected"
        fi
    else
        echo "File not found: $file"
    fi
done
