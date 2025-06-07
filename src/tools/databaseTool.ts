// 类型定义
interface Field {
  name: string
  type: 'string' | 'number' | 'boolean' | 'date' | 'enum'
  description?: string
  isOptional: boolean
  options?: string[] // 用于enum类型
}

interface ToolDefinition {
  name: string
  description: string
  fields: Field[]
}

// 将字段转换为Zod Schema
function fieldsToZodSchema (fields: Field[]): string {
  let schemaCode = '{\n'

  fields.forEach(field => {
    let zodField = ''

    // 根据字段类型生成对应的Zod验证器
    switch (field.type) {
      case 'string':
        zodField = 'z.string()'
        break
      case 'number':
        zodField = 'z.number()'
        break
      case 'boolean':
        zodField = 'z.boolean()'
        break
      case 'date':
        zodField = 'z.date()'
        break
      case 'enum':
        const enumValues =
          field.options?.map(opt => `'${opt}'`).join(', ') || ''
        zodField = `z.enum([${enumValues}])`
        break
      default:
        zodField = 'z.unknown()'
    }

    // 添加可选标记
    if (field.isOptional) {
      zodField += '.optional()'
    }

    // 添加描述
    if (field.description) {
      zodField += `.describe('${field.description}')`
    }

    schemaCode += `    ${field.name}: ${zodField},\n`
  })

  schemaCode += '  }'
  return schemaCode
}

// 生成工具代码
export function generateToolCode (toolDef: ToolDefinition): string {
  const schemaCode = fieldsToZodSchema(toolDef.fields)

  return (
    `import z from 'zod';\n\n` +
    `export const ${toolDef.name} = {\n` +
    `  name: '${toolDef.name}',\n` +
    `  description: '${toolDef.description}',\n` +
    `  schema: ${schemaCode},\n` +
    `  handler: async (\n` +
    `    args: any,\n` +
    `    client: any,\n` +
    `    sendNotification: any\n` +
    `  ) => {\n` +
    `    // 打印工具参数\n` +
    `    console.log('工具参数:', args);\n\n` +
    `    // TODO: 在这里实现工具逻辑\n\n` +
    `    return {\n` +
    `      content: [\n` +
    `        {\n` +
    `          type: 'text',\n` +
    `          text: \`处理结果: \${JSON.stringify(args)}\`\n` +
    `        }\n` +
    `      ]\n` +
    `    };\n` +
    `  }\n` +
    `};\n`
  )
}

//参数同 exampleTool
export function createDatabaseTool (
  name: string,
  description: string,
  fields: any,
  toolHandler: (args: any) => any
) {
  console.log('createDatabaseTool', name, description, fields, toolHandler)
  const toolCode = generateToolCode({
    name,description,fields
  });

  

}

// 生成参数示例
function generateJsonExample (fields: Field[]): Record<string, any> {
  const jsonExample: Record<string, any> = {}

  fields.forEach(field => {
    switch (field.type) {
      case 'string':
        jsonExample[field.name] = field.description || '示例字符串'
        break
      case 'number':
        jsonExample[field.name] = 0
        break
      case 'boolean':
        jsonExample[field.name] = true
        break
      case 'date':
        jsonExample[field.name] = new Date().toISOString()
        break
      case 'enum':
        jsonExample[field.name] = field.options?.[0] || ''
        break
      default:
        jsonExample[field.name] = null
    }
  })

  return jsonExample
}

// 使用示例
const exampleTool: ToolDefinition = {
  name: 'exampleTool',
  description: '示例工具',
  fields: [
    {
      name: 'username',
      type: 'string',
      description: '用户名',
      isOptional: false
    },
    {
      name: 'age',
      type: 'number',
      description: '年龄',
      isOptional: true
    },
    {
      name: 'role',
      type: 'enum',
      description: '角色',
      isOptional: false,
      options: ['admin', 'user', 'guest']
    }
  ]
}

//   // 生成工具代码
//   const toolCode = generateToolCode(exampleTool);
//   console.log(toolCode);

//   // 生成参数示例
//   const jsonExample = generateJsonExample(exampleTool.fields);
//   console.log(JSON.stringify(jsonExample, null, 2));
