import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert } from 'react-native';

import { ListEditor } from '@/components/list-editor';
import { Screen } from '@/components/screen';
import { MonoLabel } from '@/components/ui-kit';
import {
  useActiveRun,
  useLists,
  useSetListArchived,
  useUpdateList,
} from '@/hooks/use-work-hard';

/** Design 2d — saves only; activation happens on the Lists screen. */
export default function EditListScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data: lists, isLoading } = useLists();
  const { data: activeRun } = useActiveRun();
  const updateList = useUpdateList();
  const archive = useSetListArchived();

  const list = lists?.find((l) => l.id === id);

  if (isLoading || !list) {
    return (
      <Screen>
        <MonoLabel>{isLoading ? 'Loading…' : 'List not found'}</MonoLabel>
      </Screen>
    );
  }

  return (
    <ListEditor
      heading="Edit list"
      initialName={list.name}
      initialTasks={list.tasks.map((t) => t.name)}
      saving={updateList.isPending}
      // A list backing an active run is frozen; the run holds its own snapshot,
      // but letting the source drift mid-run would be confusing.
      locked={activeRun?.list_id === list.id}
      onArchive={() =>
        archive.mutate(
          { id: list.id, archived: true },
          {
            onSuccess: () => router.back(),
            onError: (error) => Alert.alert('Could not archive', error.message),
          },
        )
      }
      onSave={(name, tasks) =>
        updateList.mutate(
          { id: list.id, name, tasks },
          {
            onSuccess: () => router.back(),
            onError: (error) => Alert.alert('Could not save', error.message),
          },
        )
      }
    />
  );
}
