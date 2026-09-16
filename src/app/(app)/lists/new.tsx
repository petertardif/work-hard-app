import { useRouter } from 'expo-router';
import { Alert } from 'react-native';

import { ListEditor } from '@/components/list-editor';
import { useCreateList } from '@/hooks/use-work-hard';

export default function NewListScreen() {
  const router = useRouter();
  const createList = useCreateList();

  return (
    <ListEditor
      heading="New list"
      initialTasks={['']}
      saving={createList.isPending}
      onSave={(name, tasks) =>
        createList.mutate(
          { name, tasks },
          {
            onSuccess: () => router.back(),
            onError: (error) => Alert.alert('Could not save', error.message),
          },
        )
      }
    />
  );
}
