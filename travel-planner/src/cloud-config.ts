// No implicit production namespace: an approved build must select its data scope.
export function cloudScope(project: string, namespace: string) {
  if (
    !/^[a-z0-9-]+$/.test(project) ||
    !["preview-v1", "v1"].includes(namespace)
  )
    throw new Error("雲端資料範圍尚未設定");
  return `${project}:${namespace}`;
}
